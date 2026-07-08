import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, SubscriptionStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_DEFINITIONS } from '../billing/plans';
import { MercadoPagoService } from '../billing/mercadopago.service';
import { FarmsService } from '../farms/farms.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdateAccountUserDto } from './dto/update-account-user.dto';
import { UpdateMercadoPagoConfigDto } from './dto/update-mercadopago-config.dto';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';
import { ListAccountsDto } from './dto/list-accounts.dto';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ExternalQuotationsService } from '../quotations/external-quotations.service';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly farmsService: FarmsService,
    private readonly notificationsService: NotificationsService,
    private readonly externalQuotationsService: ExternalQuotationsService,
  ) {}

  // Painel de visão geral da plataforma: números que o dono acompanha no dia a dia.
  // Tudo agregado do próprio banco (assinaturas + planos), sem depender de serviço
  // externo. MRR considera apenas assinaturas ACTIVE com preço numérico (trial e
  // enterprise "fale com vendas" não entram na receita recorrente).
  async overview() {
    const now = new Date();
    const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalAccounts,
      totalFarms,
      newAccounts7d,
      newAccounts30d,
      subscriptions,
      openTickets,
    ] = await Promise.all([
      this.prisma.account.count(),
      this.prisma.farm.count(),
      this.prisma.account.count({ where: { createdAt: { gte: days7 } } }),
      this.prisma.account.count({ where: { createdAt: { gte: days30 } } }),
      this.prisma.subscription.findMany({
        select: { status: true, planTier: true },
      }),
      this.prisma.ticket.count({
        where: {
          status: { in: [TicketStatus.ABERTO, TicketStatus.EM_ANDAMENTO] },
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      TRIALING: 0,
      ACTIVE: 0,
      PAST_DUE: 0,
      CANCELED: 0,
      SUSPENDED: 0,
    };
    const planCounts: Record<string, number> = {
      TRIAL: 0,
      BASICO: 0,
      PROFISSIONAL: 0,
      ENTERPRISE: 0,
    };
    let mrr = 0;
    for (const sub of subscriptions) {
      statusCounts[sub.status] = (statusCounts[sub.status] ?? 0) + 1;
      planCounts[sub.planTier] = (planCounts[sub.planTier] ?? 0) + 1;
      if (sub.status === SubscriptionStatus.ACTIVE) {
        const price = PLAN_DEFINITIONS[sub.planTier]?.priceBRL;
        if (price) mrr += price;
      }
    }

    // Contas sem assinatura (staff da plataforma) não aparecem nos status acima.
    const withoutSubscription = totalAccounts - subscriptions.length;

    return {
      totalAccounts,
      totalFarms,
      newAccounts7d,
      newAccounts30d,
      openTickets,
      withoutSubscription,
      statusCounts,
      planCounts,
      mrr: Number(mrr.toFixed(2)),
    };
  }

  async listAccounts(query: ListAccountsDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();

    const where: Prisma.AccountWhereInput = {
      ...(query.status || query.planTier
        ? {
            subscription: {
              ...(query.status ? { status: query.status } : {}),
              ...(query.planTier ? { planTier: query.planTier } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { billingEmail: { contains: search, mode: 'insensitive' } },
              {
                users: {
                  some: { email: { contains: search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    const [total, accounts] = await Promise.all([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = accounts.map((account) => ({
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

    return { items, total, page, pageSize };
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

  getNotificationConfig() {
    return this.notificationsService.getSchedule();
  }

  updateNotificationConfig(dto: UpdateNotificationConfigDto) {
    return this.notificationsService.updateSchedule(dto);
  }

  // ---- Ações rápidas de suporte ----

  // Estende o período de teste: soma os dias a partir da data atual de término do
  // trial (ou de agora, se já passou) e recoloca a assinatura em TRIALING.
  async extendTrial(accountId: string, days: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId },
    });
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada para esta conta');
    }
    const now = new Date();
    const base =
      subscription.trialEndsAt && subscription.trialEndsAt > now
        ? subscription.trialEndsAt
        : now;
    const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.update({
      where: { accountId },
      data: { trialEndsAt, status: SubscriptionStatus.TRIALING },
    });
  }

  // Dispara a geração de notificações para todas as fazendas da conta (mesma lógica
  // do cron/da tela do cliente), útil para o suporte "forçar" um alerta na hora.
  async generateNotificationsForAccount(accountId: string) {
    const farms = await this.prisma.farm.findMany({
      where: { accountId },
      select: { id: true },
    });
    let created = 0;
    for (const farm of farms) {
      const res = await this.notificationsService.generateFromAlerts(farm.id);
      created += res.created;
    }
    return { farms: farms.length, created };
  }

  // Atualização manual das cotações (global). Reaproveita o fetch da Redação Agro.
  refreshQuotations() {
    return this.externalQuotationsService.refresh();
  }

  // ---- Auditoria ----

  async listAuditLogs(query: ListAuditLogsDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const search = query.search?.trim();

    const where: Prisma.AuditLogWhereInput = {
      ...(query.method ? { method: query.method } : {}),
      ...(search
        ? {
            OR: [
              { userEmail: { contains: search, mode: 'insensitive' } },
              { path: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize };
  }
}
