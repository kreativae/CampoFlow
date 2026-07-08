import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlanTier, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoService } from './mercadopago.service';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  PLAN_DEFINITIONS,
  TRIAL_DURATION_DAYS,
} from './plans';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  // Called once at registration (see AuthService.register) — every account starts
  // on a 30-day trial capped at 2 farms, same limit as the BASICO plan.
  async createTrialSubscription(accountId: string) {
    return this.prisma.subscription.create({
      data: {
        accountId,
        planTier: PlanTier.TRIAL,
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: new Date(
          Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });
  }

  async getForAccount(accountId: string) {
    const [subscription, farmCount] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { accountId } }),
      this.prisma.farm.count({ where: { accountId } }),
    ]);
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada para esta conta');
    }

    const plan = PLAN_DEFINITIONS[subscription.planTier];
    return {
      ...subscription,
      plan,
      farmsUsed: farmCount,
      farmsLimit: plan.maxFarms,
    };
  }

  // Throws if the account's plan does not allow creating another farm. Called from
  // FarmsService.create() before the insert — the "a partir de 3 fazendas" rule the
  // user asked for: TRIAL/BASICO cap at 2, so the 3rd farm requires an upgrade.
  async assertCanCreateFarm(accountId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId },
    });
    if (!subscription) return; // Should not happen outside of tests/seed data.

    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status as never)) {
      throw new ForbiddenException(
        'Sua assinatura não está ativa. Atualize o pagamento em /conta/assinatura para continuar.',
      );
    }

    const plan = PLAN_DEFINITIONS[subscription.planTier];
    if (plan.maxFarms === null) return; // unlimited (ENTERPRISE)

    const farmCount = await this.prisma.farm.count({ where: { accountId } });
    if (farmCount >= plan.maxFarms) {
      throw new ForbiddenException(
        `O plano ${plan.label} permite até ${plan.maxFarms} fazenda(s). ` +
          'Faça upgrade em /conta/assinatura para cadastrar mais.',
      );
    }
  }

  // Starts a Mercado Pago recurring subscription (PreApproval) and returns the
  // checkout URL the frontend should redirect the payer to. The subscription only
  // becomes ACTIVE once Mercado Pago confirms via webhook (see handleWebhook).
  async startCheckout(
    accountId: string,
    payerEmail: string,
    planTier: 'BASICO' | 'PROFISSIONAL',
  ) {
    if (!this.mercadoPago.isConfigured()) {
      throw new BadRequestException(
        'Pagamentos não estão configurados neste ambiente (MERCADOPAGO_ACCESS_TOKEN ausente).',
      );
    }

    const plan = PLAN_DEFINITIONS[planTier];
    if (plan.priceBRL === null) {
      throw new BadRequestException(
        'Este plano não tem checkout self-service. Fale com vendas.',
      );
    }

    const backUrl =
      process.env.WEB_BILLING_REDIRECT_URL ||
      'http://localhost:3100/conta/assinatura';
    // Em produção, localhost é rejeitado pelo Mercado Pago (400 back_url inválida).
    // Falhar aqui, com mensagem clara, é melhor do que deixar cada tentativa de
    // checkout falhar com erro do MP até alguém perceber.
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.WEB_BILLING_REDIRECT_URL
    ) {
      throw new BadRequestException(
        'WEB_BILLING_REDIRECT_URL não está definida. Configure a env com a URL pública (https) do painel para habilitar o checkout do Mercado Pago.',
      );
    }

    const result = await this.mercadoPago.createSubscription({
      reason: `CampoFlow — Plano ${plan.label}`,
      payerEmail,
      transactionAmount: plan.priceBRL,
      externalReference: `${accountId}:${planTier}`,
      backUrl,
    });

    await this.prisma.subscription.update({
      where: { accountId },
      data: { mercadoPagoPreapprovalId: result.id },
    });

    return { checkoutUrl: result.initPoint };
  }

  async cancel(accountId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId },
    });
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada para esta conta');
    }

    if (subscription.mercadoPagoPreapprovalId) {
      await this.mercadoPago.cancelSubscription(
        subscription.mercadoPagoPreapprovalId,
      );
    }

    return this.prisma.subscription.update({
      where: { accountId },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });
  }

  // Mercado Pago notifies asynchronously on every preapproval state change
  // (authorized, paused, cancelled). We re-fetch the object instead of trusting the
  // webhook body directly, since MP webhooks only reliably carry the resource id.
  async handleWebhook(preapprovalId: string) {
    const remote = await this.mercadoPago.getSubscription(preapprovalId);
    if (!remote?.external_reference) {
      this.logger.warn(
        `Webhook do Mercado Pago sem external_reference: ${preapprovalId}`,
      );
      await this.mercadoPago.recordWebhook(
        preapprovalId,
        false,
        'Webhook sem external_reference',
      );
      return;
    }

    const [accountId, planTier] = remote.external_reference.split(':') as [
      string,
      PlanTier,
    ];
    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId },
    });
    if (
      !subscription ||
      subscription.mercadoPagoPreapprovalId !== preapprovalId
    ) {
      this.logger.warn(
        `Webhook do Mercado Pago para preapproval desconhecido: ${preapprovalId}`,
      );
      await this.mercadoPago.recordWebhook(
        preapprovalId,
        false,
        'Preapproval desconhecido',
      );
      return;
    }

    const status = this.mapRemoteStatus(remote.status);
    await this.prisma.subscription.update({
      where: { accountId },
      data: {
        status,
        planTier:
          status === SubscriptionStatus.ACTIVE
            ? planTier
            : subscription.planTier,
        currentPeriodEnd: remote.next_payment_date
          ? new Date(remote.next_payment_date)
          : subscription.currentPeriodEnd,
      },
    });

    await this.mercadoPago.recordWebhook(
      preapprovalId,
      true,
      `Assinatura da conta ${accountId} atualizada para status ${status}`,
    );
  }

  private mapRemoteStatus(remoteStatus?: string): SubscriptionStatus {
    switch (remoteStatus) {
      case 'authorized':
        return SubscriptionStatus.ACTIVE;
      case 'paused':
        return SubscriptionStatus.PAST_DUE;
      case 'cancelled':
        return SubscriptionStatus.CANCELED;
      default:
        return SubscriptionStatus.PAST_DUE;
    }
  }

  // Daily sweep: trials that expired without converting to a paid plan get
  // suspended (blocks mutating requests — see SubscriptionGuard) until they
  // subscribe.
  @Cron('0 6 * * *')
  async expireTrials() {
    const result = await this.prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.SUSPENDED },
    });
    if (result.count > 0) {
      this.logger.log(
        `${result.count} teste(s) gratuito(s) expiraram e foram suspensos`,
      );
    }
  }
}
