import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { EmailService } from '../common/email/email.service';
import { BillingService } from '../billing/billing.service';
import { CANCELED_DATA_RETENTION_DAYS } from '../billing/plans';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

const INVITE_TOKEN_SALT_ROUNDS = 10;
const INVITE_TTL_DAYS = 7;

@Injectable()
export class FarmsService {
  private readonly logger = new Logger(FarmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly billingService: BillingService,
  ) {}

  async create(ownerId: string, accountId: string, dto: CreateFarmDto) {
    await this.billingService.assertCanCreateFarm(accountId);

    return this.prisma.farm.create({
      data: {
        ...dto,
        accountId,
        memberships: {
          create: { userId: ownerId, role: Role.OWNER },
        },
      },
      include: { memberships: true },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.farm.findMany({
      where: { memberships: { some: { userId } } },
    });
  }

  async findOne(farmId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException('Propriedade não encontrada');
    }
    return farm;
  }

  async update(farmId: string, dto: UpdateFarmDto) {
    await this.findOne(farmId);
    return this.prisma.farm.update({ where: { id: farmId }, data: dto });
  }

  // Excluir uma fazenda é irreversível: removemos explicitamente todos os
  // registros vinculados (em todos os módulos) antes da fazenda, pois nem
  // toda relação no schema está configurada com cascade automático no banco.
  async remove(farmId: string) {
    await this.findOne(farmId);

    const [documents, soilAnalyses] = await Promise.all([
      this.prisma.document.findMany({
        where: { farmId },
        select: { storagePath: true },
      }),
      this.prisma.soilAnalysis.findMany({
        where: { farmId, documentPath: { not: null } },
        select: { documentPath: true },
      }),
    ]);

    await this.prisma.$transaction([
      this.prisma.animalEvent.deleteMany({ where: { animal: { farmId } } }),
      this.prisma.vaccinationRecord.deleteMany({
        where: { animal: { farmId } },
      }),
      this.prisma.treatmentRecord.deleteMany({ where: { animal: { farmId } } }),
      this.prisma.weighingRecord.deleteMany({ where: { animal: { farmId } } }),
      this.prisma.reproductiveEvent.deleteMany({
        where: { animal: { farmId } },
      }),
      this.prisma.animal.deleteMany({ where: { farmId } }),
      this.prisma.pasture.deleteMany({ where: { farmId } }),
      this.prisma.machine.deleteMany({ where: { farmId } }),
      this.prisma.supply.deleteMany({ where: { farmId } }),
      this.prisma.soilAnalysis.deleteMany({ where: { farmId } }),
      this.prisma.mapFeature.deleteMany({ where: { farmId } }),
      this.prisma.transaction.deleteMany({ where: { farmId } }),
      this.prisma.weatherRecord.deleteMany({ where: { farmId } }),
      this.prisma.task.deleteMany({ where: { farmId } }),
      this.prisma.workLog.deleteMany({ where: { farmId } }),
      this.prisma.shift.deleteMany({ where: { farmId } }),
      this.prisma.agendaEvent.deleteMany({ where: { farmId } }),
      this.prisma.document.deleteMany({ where: { farmId } }),
      this.prisma.notification.deleteMany({ where: { farmId } }),
      this.prisma.membership.deleteMany({ where: { farmId } }),
      this.prisma.farm.delete({ where: { id: farmId } }),
    ]);

    await Promise.all([
      ...documents.map((d) => this.storageService.delete(d.storagePath)),
      ...soilAnalyses.map((s) => this.storageService.delete(s.documentPath!)),
    ]);

    return { success: true };
  }

  // If the e-mail already belongs to a registered user, add them immediately
  // (unchanged behavior). Otherwise create a pending FarmInvite and e-mail a link
  // to accept it — registering or logging in with that same e-mail and accepting
  // turns it into a real Membership (see acceptInvite()).
  async addMember(farmId: string, dto: AddMemberDto, inviterId: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const membership = await this.prisma.membership.upsert({
        where: { userId_farmId: { userId: user.id, farmId } },
        update: { role: dto.role, moduleAccess: dto.moduleAccess ?? [] },
        create: {
          userId: user.id,
          farmId,
          role: dto.role,
          moduleAccess: dto.moduleAccess ?? [],
        },
      });

      if (this.emailService.isConfigured()) {
        const farm = await this.findOne(farmId);
        await this.emailService.send(
          user.email,
          'Você foi adicionado a uma propriedade — CampoFlow',
          `<p>Olá, ${user.name}.</p>` +
            `<p>Você foi adicionado à propriedade <strong>${farm.name}</strong> no CampoFlow, com o papel de ${dto.role}.</p>`,
        );
      }

      return membership;
    }

    return this.createInvite(farmId, dto, inviterId);
  }

  private async createInvite(
    farmId: string,
    dto: AddMemberDto,
    inviterId: string,
  ) {
    const farm = await this.findOne(farmId);
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, INVITE_TOKEN_SALT_ROUNDS);

    const invite = await this.prisma.farmInvite.create({
      data: {
        farmId,
        email: dto.email,
        role: dto.role,
        moduleAccess: dto.moduleAccess ?? [],
        tokenHash,
        invitedById: inviterId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    const webBase =
      process.env.WEB_INVITE_URL || 'http://localhost:3100/convites/aceitar';
    const acceptUrl = `${webBase}?token=${encodeURIComponent(rawToken)}`;

    if (this.emailService.isConfigured()) {
      await this.emailService.send(
        dto.email,
        'Convite para colaborar em uma propriedade — CampoFlow',
        `<p>Você foi convidado para colaborar na propriedade <strong>${farm.name}</strong> ` +
          `no CampoFlow, com o papel de ${dto.role}.</p>` +
          `<p><a href="${acceptUrl}">Clique aqui para aceitar o convite</a>. ` +
          `Se ainda não tem conta, crie uma com este mesmo e-mail (${dto.email}) primeiro. ` +
          'Este link expira em 7 dias.</p>',
      );
    } else {
      this.logger.warn(
        `RESEND_API_KEY não configurado — link de convite para ${dto.email}: ${acceptUrl}`,
      );
    }

    return {
      invited: true,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  async listInvites(farmId: string) {
    return this.prisma.farmInvite.findMany({
      where: { farmId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvite(farmId: string, inviteId: string) {
    const invite = await this.prisma.farmInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.farmId !== farmId) {
      throw new NotFoundException('Convite não encontrado');
    }
    await this.prisma.farmInvite.delete({ where: { id: inviteId } });
    return { success: true };
  }

  // Called by InvitesController once the invited person is authenticated. Requires
  // the logged-in user's e-mail to match the invite's e-mail — a token leak alone
  // isn't enough to join a farm under someone else's identity.
  async acceptInvite(rawToken: string, userId: string, userEmail: string) {
    const candidates = await this.prisma.farmInvite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(rawToken, candidate.tokenHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new NotFoundException('Convite inválido ou expirado');
    }
    if (matched.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new BadRequestException(
        'Este convite foi enviado para outro e-mail. Entre com a conta correta para aceitar.',
      );
    }

    const [, membership] = await this.prisma.$transaction([
      this.prisma.farmInvite.update({
        where: { id: matched.id },
        data: { acceptedAt: new Date() },
      }),
      this.prisma.membership.upsert({
        where: { userId_farmId: { userId, farmId: matched.farmId } },
        update: { role: matched.role, moduleAccess: matched.moduleAccess },
        create: {
          userId,
          farmId: matched.farmId,
          role: matched.role,
          moduleAccess: matched.moduleAccess,
        },
      }),
    ]);

    return membership;
  }

  async listMembers(farmId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { farmId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      moduleAccess: m.moduleAccess,
    }));
  }

  // Papel + allowlist de módulos do usuário logado nesta propriedade. Usado pelo
  // painel web para esconder da navegação os módulos que o membro não pode acessar.
  async getMyAccess(farmId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_farmId: { userId, farmId } },
    });
    if (!membership) {
      throw new NotFoundException('Você não é membro desta propriedade');
    }
    return {
      role: membership.role,
      // Proprietário sempre tem acesso total, independentemente do allowlist.
      moduleAccess:
        membership.role === Role.OWNER ? [] : membership.moduleAccess,
    };
  }

  async updateMember(farmId: string, userId: string, dto: UpdateMemberDto) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_farmId: { userId, farmId } },
    });
    if (!membership) {
      throw new NotFoundException('Membro não encontrado nesta propriedade');
    }

    // Ao rebaixar o papel de um proprietário, garantir que sobre pelo menos um.
    if (
      membership.role === Role.OWNER &&
      dto.role !== undefined &&
      dto.role !== Role.OWNER
    ) {
      const ownerCount = await this.prisma.membership.count({
        where: { farmId, role: Role.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Não é possível rebaixar o único proprietário da propriedade',
        );
      }
    }

    const updated = await this.prisma.membership.update({
      where: { userId_farmId: { userId, farmId } },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.moduleAccess !== undefined
          ? { moduleAccess: dto.moduleAccess }
          : {}),
      },
    });
    return {
      userId: updated.userId,
      role: updated.role,
      moduleAccess: updated.moduleAccess,
    };
  }

  async removeMember(farmId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_farmId: { userId, farmId } },
    });
    if (!membership) {
      throw new NotFoundException('Membro não encontrado nesta propriedade');
    }

    if (membership.role === Role.OWNER) {
      const ownerCount = await this.prisma.membership.count({
        where: { farmId, role: Role.OWNER },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Não é possível remover o único proprietário da propriedade',
        );
      }
    }

    await this.prisma.membership.delete({
      where: { userId_farmId: { userId, farmId } },
    });
    return { success: true };
  }

  // LGPD data-retention sweep: accounts canceled for longer than
  // CANCELED_DATA_RETENTION_DAYS have all their farm data permanently purged (reusing
  // the same cascade-safe deletion as a manual "excluir fazenda"). The Account/User
  // rows are kept — see plans.ts for why — so a resubscription doesn't require a new
  // signup, it just starts from zero farms again.
  @Cron('0 7 * * *')
  async purgeCanceledAccountsData() {
    const cutoff = new Date(
      Date.now() - CANCELED_DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const overdueAccounts = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: { lt: cutoff },
      },
      select: { accountId: true },
    });
    if (overdueAccounts.length === 0) return;

    const farms = await this.prisma.farm.findMany({
      where: { accountId: { in: overdueAccounts.map((a) => a.accountId) } },
      select: { id: true, name: true, accountId: true },
    });

    for (const farm of farms) {
      try {
        await this.remove(farm.id);
        this.logger.log(
          `Dados da fazenda "${farm.name}" (conta ${farm.accountId}) purgados após ${CANCELED_DATA_RETENTION_DAYS} dias de cancelamento`,
        );
      } catch (err) {
        this.logger.warn(
          `Falha ao purgar a fazenda ${farm.id} da conta ${farm.accountId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
