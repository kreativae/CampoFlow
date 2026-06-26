import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokens, JwtPayload } from './auth.types';
import { GoogleProfile } from './strategies/google.strategy';

const PASSWORD_SALT_ROUNDS = 10;
const MFA_ISSUER = 'CampoFlow';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('E-mail já está em uso');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    const tokens = await this.issueTokens(user.id, user.email);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Esta conta usa login com Google. Use o botão "Entrar com Google".',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        return { mfaRequired: true };
      }
      if (
        !user.mfaSecret ||
        !authenticator.check(
          dto.mfaCode,
          this.encryptionService.decrypt(user.mfaSecret),
        )
      ) {
        throw new UnauthorizedException('Código de autenticação inválido');
      }
    }

    const tokens = await this.issueTokens(user.id, user.email);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { user: this.toSafeUser(user), ...tokens };
  }

  // Generates a new TOTP secret and a QR code (data URL) for the user to scan with
  // an authenticator app (Google Authenticator, Authy, etc.). MFA is not enabled yet
  // at this point — enableMfa() requires a valid code to confirm the setup first, so a
  // user can't get locked out by scanning the QR code incorrectly.
  async setupMfa(userId: string, email: string) {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: this.encryptionService.encrypt(secret),
        mfaEnabled: false,
      },
    });

    const otpUrl = authenticator.keyuri(email, MFA_ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpUrl);
    return { secret, qrCodeDataUrl };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new BadRequestException(
        'MFA não foi configurado. Chame /auth/mfa/setup primeiro.',
      );
    }
    if (
      !authenticator.check(code, this.encryptionService.decrypt(user.mfaSecret))
    ) {
      throw new UnauthorizedException('Código de autenticação inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    return { mfaEnabled: true };
  }

  async disableMfa(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { mfaEnabled: false };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }

  isGoogleConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return this.toSafeUser(user);
  }

  // Finds an existing account by googleId, links Google to an existing account that
  // registered with the same email (so a user who signed up with a password can also
  // use "Entrar com Google" afterwards), or creates a brand-new OAuth-only account
  // (passwordHash stays null — see schema comment). MFA is not re-checked here: Google
  // already required the user to authenticate on its end, so we treat that as
  // sufficient for this login. A user who wants MFA enforced on every login should use
  // the password flow instead — a known limitation, not an oversight.
  async loginWithGoogle(profile: GoogleProfile) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      user = existingByEmail
        ? await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: { googleId: profile.googleId },
          })
        : await this.prisma.user.create({
            data: {
              email: profile.email,
              name: profile.name,
              googleId: profile.googleId,
            },
          });
    }

    const tokens = await this.issueTokens(user.id, user.email);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { user: this.toSafeUser(user), ...tokens };
  }

  // LGPD right of access: a self-service export of everything personal data the
  // platform holds about the user, in one JSON document.
  async exportPersonalData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { farm: { select: { id: true, name: true } } },
        },
        assignedTasks: true,
        workLogs: true,
        shifts: true,
        notifications: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      memberships: user.memberships.map((m) => ({
        farmId: m.farmId,
        farmName: m.farm.name,
        role: m.role,
        since: m.createdAt,
      })),
      assignedTasks: user.assignedTasks,
      workLogs: user.workLogs,
      shifts: user.shifts,
      notifications: user.notifications,
    };
  }

  // LGPD right to erasure. We don't hard-delete the User row outright: WorkLog/Shift/
  // Task records reference it and are legitimate shared operational history of a farm
  // (other members rely on them), so we anonymize the account instead of corrupting
  // that history. Memberships and personal in-app notifications, which belong only to
  // this user, are actually deleted. If the user is the sole OWNER of any farm, we
  // refuse — deleting them would leave that farm ownerless.
  async deleteAccount(userId: string) {
    const ownerships = await this.prisma.membership.findMany({
      where: { userId, role: Role.OWNER },
      include: {
        farm: {
          include: { memberships: { where: { role: Role.OWNER } } },
        },
      },
    });
    const soleOwnerFarms = ownerships
      .filter((m) => m.farm.memberships.length <= 1)
      .map((m) => m.farm.name);

    if (soleOwnerFarms.length > 0) {
      throw new ConflictException(
        `Você é o único proprietário das fazendas: ${soleOwnerFarms.join(', ')}. ` +
          'Transfira a propriedade para outro membro ou exclua essas fazendas antes de excluir sua conta.',
      );
    }

    await this.prisma.notification.deleteMany({ where: { userId } });
    await this.prisma.membership.deleteMany({ where: { userId } });

    const unusablePassword = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      PASSWORD_SALT_ROUNDS,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@campoflow.invalid`,
        name: 'Usuário removido',
        passwordHash: unusablePassword,
        refreshTokenHash: null,
        mfaSecret: null,
        mfaEnabled: false,
      },
    });

    return { success: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ??
        '15m') as JwtSignOptions['expiresIn'],
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ??
        '7d') as JwtSignOptions['expiresIn'],
    });

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      PASSWORD_SALT_ROUNDS,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string;
    mfaEnabled: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mfaEnabled: user.mfaEnabled,
    };
  }
}
