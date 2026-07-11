import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';

export interface StripeConfigStatus {
  configured: boolean;
  source: 'banco' | 'variavel_de_ambiente' | 'nenhum';
  secretKeyMasked: string | null;
  webhookSecretSet: boolean;
  webhookEndpointUrl: string;
  nodeEnv: string;
}

export interface UpdateStripeConfigInput {
  secretKey?: string;
  webhookSecret?: string;
}

const SETTING_ID = 'stripe';

function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 7)}••••${key.slice(-4)}`;
}

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;
  private secretKey: string | undefined;
  private webhookSecret: string | null = null;
  private source: StripeConfigStatus['source'] = 'nenhum';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async onModuleInit() {
    await this.loadConfig();
  }

  private async loadConfig() {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { id: SETTING_ID },
    });

    if (setting?.accessToken) {
      this.secretKey = this.encryptionService.decrypt(setting.accessToken);
      this.webhookSecret = setting.webhookSecret
        ? this.encryptionService.decrypt(setting.webhookSecret)
        : null;
      this.source = 'banco';
    } else {
      this.secretKey = process.env.STRIPE_SECRET_KEY;
      this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? null;
      this.source = this.secretKey ? 'variavel_de_ambiente' : 'nenhum';
    }

    this.client = this.secretKey ? new Stripe(this.secretKey) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getConfigStatus(): StripeConfigStatus {
    const apiBase = process.env.API_PUBLIC_URL || 'http://localhost:3000';
    return {
      configured: this.isConfigured(),
      source: this.source,
      secretKeyMasked: this.secretKey ? maskKey(this.secretKey) : null,
      webhookSecretSet: Boolean(this.webhookSecret),
      webhookEndpointUrl: `${apiBase.replace(/\/$/, '')}/conta/assinatura/webhook/stripe`,
      nodeEnv: process.env.NODE_ENV ?? 'development',
    };
  }

  async updateConfig(
    dto: UpdateStripeConfigInput,
  ): Promise<StripeConfigStatus> {
    await this.prisma.platformSetting.upsert({
      where: { id: SETTING_ID },
      create: {
        id: SETTING_ID,
        accessToken: dto.secretKey
          ? this.encryptionService.encrypt(dto.secretKey)
          : null,
        webhookSecret: dto.webhookSecret
          ? this.encryptionService.encrypt(dto.webhookSecret)
          : null,
      },
      update: {
        ...(dto.secretKey !== undefined
          ? { accessToken: this.encryptionService.encrypt(dto.secretKey) }
          : {}),
        ...(dto.webhookSecret !== undefined
          ? { webhookSecret: this.encryptionService.encrypt(dto.webhookSecret) }
          : {}),
      },
    });

    await this.loadConfig();
    return this.getConfigStatus();
  }

  async createCheckoutSession(input: {
    priceId: string;
    customerEmail: string;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string }> {
    if (!this.client) throw new Error('Stripe não configurado');

    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: input.customerEmail,
      line_items: [{ price: input.priceId, quantity: 1 }],
      metadata: input.metadata,
      subscription_data: { metadata: input.metadata },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });

    return { id: session.id, url: session.url! };
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.subscriptions.cancel(stripeSubscriptionId);
    } catch (err) {
      this.logger.warn(
        `Falha ao cancelar assinatura Stripe ${stripeSubscriptionId}: ${(err as Error).message}`,
      );
    }
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): Stripe.Event | null {
    if (!this.client || !this.webhookSecret) {
      this.logger.warn(
        'Webhook Stripe recebido sem webhookSecret configurado — ignorando verificação',
      );
      return null;
    }
    try {
      return this.client.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.warn(
        `Assinatura do webhook Stripe inválida: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
