import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_DEFINITIONS } from '../billing/plans';
import { MercadoPagoService } from '../billing/mercadopago.service';
import { FarmsService } from '../farms/farms.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateAccountUserDto } from './dto/update-account-user.dto';
import { UpdateMercadoPagoConfigDto } from './dto/update-mercadopago-config.dto';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly farmsService: FarmsService,
  ) {}

  async listAccounts() {
    const accounts = await this.prisma.account.findMany({
      include: {
        subscription: true,
        _count: { select: { farms: true } },
        users: {
          where: { isAccountAdmin: true },
          select: { email: true, name: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      billingEmail: account.billingEmail,
      owner: account.users[0] ?? null,
      farmsUsed: account._count.farms,
      planTier: account.subscription?.planTier ?? null,
      status: account.subscription?.status ?? null,
      trialEndsAt: account.subscription?.trialEndsAt ?? null,
      currentPeriodEnd: account.subscription?.currentPeriodEnd ?? null,
      createdAt: account.createdAt,
    }));
  }

  async getAccount(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        subscription: true,
        farms: { select: { id: true, name: true, createdAt: true } },
        users: {
          select: { id: true, email: true, name: true, isAccountAdmin: true },
        },
      },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    const plan = account.subscription
      ? PLAN_DEFINITIONS[account.subscription.planTier]
      : null;

    const paymentHistory = account.subscription?.mercadoPagoPreapprovalId
      ? await this.mercadoPagoService.getPaymentHistory(
          account.subscription.mercadoPagoPreapprovalId,
        )
      : [];

    return { ...account, plan, paymentHistory };
  }

  async updateAccount(accountId: string, dto: UpdateAccountDto) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.billingEmail !== undefined
          ? { billingEmail: dto.billingEmail }
          : {}),
        ...(dto.document !== undefined ? { document: dto.document } : {}),
      },
    });
  }

  // Full profile edit for support cases: promote/demote isAccountAdmin, fix a
  // typo'd e-mail, or reset a locked-out customer's password — all without
  // needing their old password (unlike the self-service flows in AuthService).
  async updateAccountUser(
    accountId: string,
    userId: string,
    dto: UpdateAccountUserDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.accountId !== accountId) {
      throw new NotFoundException('Usuário não encontrado nesta conta');
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('E-mail já está em uso por outro usuário');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.isAccountAdmin !== undefined
          ? { isAccountAdmin: dto.isAccountAdmin }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.password !== undefined
          ? {
              passwordHash: await bcrypt.hash(
                dto.password,
                PASSWORD_SALT_ROUNDS,
              ),
            }
          : {}),
      },
      select: { id: true, email: true, name: true, isAccountAdmin: true },
    });
  }

  // Support override: lets platform staff fix a stuck subscription, grant a comp
  // plan, or manually reactivate an account without going through Mercado Pago.
  async updateSubscription(accountId: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId },
    });
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada para esta conta');
    }

    return this.prisma.subscription.update({
      where: { accountId },
      data: {
        ...(dto.planTier ? { planTier: dto.planTier } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  // Full teardown of a customer account from the support side: cancels the
  // Mercado Pago subscription, removes every farm (reusing FarmsService.remove()
  // for its per-farm cascade + storage cleanup), then the account's own rows.
  // Irreversible — the web confirmation requires typing the account name.
  async deleteAccount(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { subscription: true, farms: { select: { id: true } } },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    if (account.subscription?.mercadoPagoPreapprovalId) {
      await this.mercadoPagoService.cancelSubscription(
        account.subscription.mercadoPagoPreapprovalId,
      );
    }

    for (const farm of account.farms) {
      await this.farmsService.remove(farm.id);
    }

    await this.prisma.ticketMessage.deleteMany({
      where: { ticket: { accountId } },
    });
    await this.prisma.ticket.deleteMany({ where: { accountId } });
    await this.prisma.membership.deleteMany({
      where: { user: { accountId } },
    });
    await this.prisma.subscription.deleteMany({ where: { accountId } });
    await this.prisma.user.deleteMany({ where: { accountId } });
    await this.prisma.account.delete({ where: { id: accountId } });

    return { success: true };
  }

  // Bulk variant for the multi-select checkboxes in /admin — sequential, not
  // parallel, so a failure on one account doesn't leave a half-finished cascade
  // racing another deleteAccount() call against shared tables.
  async deleteAccounts(accountIds: string[]) {
    const results: { accountId: string; success: boolean; error?: string }[] =
      [];
    for (const accountId of accountIds) {
      try {
        await this.deleteAccount(accountId);
        results.push({ accountId, success: true });
      } catch (err) {
        results.push({
          accountId,
          success: false,
          error: (err as Error).message,
        });
      }
    }
    return results;
  }

  getMercadoPagoConfig() {
    return this.mercadoPagoService.getConfigStatus();
  }

  updateMercadoPagoConfig(dto: UpdateMercadoPagoConfigDto) {
    return this.mercadoPagoService.updateConfig(dto);
  }

  getMercadoPagoLogs() {
    return this.mercadoPagoService.getLogs();
  }
}
