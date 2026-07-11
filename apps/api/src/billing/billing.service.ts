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
import { StripeService } from './stripe.service';
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
    private readonly stripe: StripeService,
  ) {}

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

  async assertCanCreateFarm(accountId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId },
    });
    if (!subscription) return;

    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status as never)) {
      throw new ForbiddenException(
        'Sua assinatura não está ativa. Atualize o pagamento em /conta/assinatura para continuar.',
      );
    }

    const plan = PLAN_DEFINITIONS[subscription.planTier];
    if (plan.maxFarms === null) return;

    const farmCount = await this.prisma.farm.count({ where: { accountId } });
    if (farmCount >= plan.maxFarms) {
      throw new ForbiddenException(
        `O plano ${plan.label} permite até ${plan.maxFarms} fazenda(s). ` +
          'Faça upgrade em /conta/assinatura para cadastrar mais.',
      );
    }
  }

  async startCheckout(
    accountId: string,
    payerEmail: string,
    planTier: 'BASICO' | 'PROFISSIONAL',
  ) {
    if (!this.stripe.isConfigured()) {
      throw new BadRequestException(
        'Pagamentos não estão configurados neste ambiente (STRIPE_SECRET_KEY ausente).',
      );
    }

    const plan = PLAN_DEFINITIONS[planTier];
    if (plan.priceBRL === null) {
      throw new BadRequestException(
        'Este plano não tem checkout self-service. Fale com vendas.',
      );
    }

    if (!plan.stripePriceId) {
      throw new BadRequestException(
        `STRIPE_PRICE_ID_${planTier} não está configurado. Defina o Price ID do plano no Stripe.`,
      );
    }

    const baseUrl =
      process.env.WEB_BILLING_REDIRECT_URL ||
      'http://localhost:3100/conta/assinatura';

    const result = await this.stripe.createCheckoutSession({
      priceId: plan.stripePriceId,
      customerEmail: payerEmail,
      metadata: { accountId, planTier },
      successUrl: `${baseUrl}?checkout=success`,
      cancelUrl: `${baseUrl}?checkout=cancel`,
    });

    return { checkoutUrl: result.url };
  }

  async cancel(accountId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { accountId },
    });
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada para esta conta');
    }

    if (subscription.stripeSubscriptionId) {
      await this.stripe.cancelSubscription(subscription.stripeSubscriptionId);
    }

    return this.prisma.subscription.update({
      where: { accountId },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const event = this.stripe.constructWebhookEvent(payload, signature);

    if (!event) {
      // Sem webhookSecret configurado — aceitar sem verificar (não ideal em prod)
      this.logger.warn('Webhook Stripe processado sem verificação de assinatura');
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          metadata?: Record<string, string>;
          subscription?: string;
        };
        const { accountId, planTier } = session.metadata ?? {};
        if (!accountId || !planTier) {
          this.logger.warn('checkout.session.completed sem metadata accountId/planTier');
          return;
        }
        await this.prisma.subscription.update({
          where: { accountId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            planTier: planTier as PlanTier,
            stripeSubscriptionId: session.subscription ?? null,
          },
        });
        this.logger.log(`Assinatura ativada para conta ${accountId} — plano ${planTier}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          id: string;
          status: string;
          current_period_end: number;
          metadata?: Record<string, string>;
        };
        const accountId = sub.metadata?.accountId;
        if (!accountId) {
          // Tenta achar pelo stripeSubscriptionId
          const record = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: sub.id },
          });
          if (!record) return;
          await this.prisma.subscription.update({
            where: { id: record.id },
            data: {
              status: this.mapStripeStatus(sub.status),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          });
        } else {
          await this.prisma.subscription.update({
            where: { accountId },
            data: {
              status: this.mapStripeStatus(sub.status),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as { id: string; metadata?: Record<string, string> };
        const accountId = sub.metadata?.accountId;
        if (accountId) {
          await this.prisma.subscription.update({
            where: { accountId },
            data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
          });
        } else {
          const record = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: sub.id },
          });
          if (record) {
            await this.prisma.subscription.update({
              where: { id: record.id },
              data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
            });
          }
        }
        break;
      }

      default:
        this.logger.log(`Evento Stripe ignorado: ${event.type}`);
    }
  }

  private mapStripeStatus(status: string): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
      case 'cancelled':
        return SubscriptionStatus.CANCELED;
      default:
        return SubscriptionStatus.PAST_DUE;
    }
  }

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
