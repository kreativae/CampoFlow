import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { MercadoPagoLogEvent } from '@prisma/client';

export interface CreatePreapprovalInput {
  reason: string;
  payerEmail: string;
  transactionAmount: number;
  externalReference: string;
  backUrl: string;
}

export interface PaymentHistoryEntry {
  id: number;
  status: string;
  transactionAmount: number;
  currencyId: string;
  dateApproved: string | null;
  dateCreated: string;
}

export interface MercadoPagoConfigStatus {
  configured: boolean;
  source: 'banco' | 'variavel_de_ambiente' | 'nenhum';
  accessTokenMasked: string | null;
  publicKey: string | null;
  webhookSecretSet: boolean;
  // Estado do checklist de produção, para orientar o admin.
  billingRedirectUrl: string | null;
  webhookEndpointUrl: string;
  nodeEnv: string;
}

export interface UpdateMercadoPagoConfigInput {
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string;
}

const SETTING_ID = 'mercadopago';

function maskToken(token: string): string {
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

// Thin wrapper around the Mercado Pago SDK, mirroring EmailService/StorageService:
// without a configured access token, isConfigured() returns false and BillingService
// is expected to fall back to a "fale com vendas" response instead of attempting
// checkout. Credentials can come from the admin UI (PlatformSetting row, access
// token encrypted at rest) or from MERCADOPAGO_ACCESS_TOKEN — the DB value takes
// precedence so staff can rotate tokens without redeploying.
@Injectable()
export class MercadoPagoService implements OnModuleInit {
  private readonly logger = new Logger(MercadoPagoService.name);
  private preApproval: PreApproval | null = null;
  private accessToken: string | undefined;
  private publicKey: string | null = null;
  private webhookSecret: string | null = null;
  private source: MercadoPagoConfigStatus['source'] = 'nenhum';

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
      this.accessToken = this.encryptionService.decrypt(setting.accessToken);
      this.publicKey = setting.publicKey ?? null;
      this.webhookSecret = setting.webhookSecret
        ? this.encryptionService.decrypt(setting.webhookSecret)
        : null;
      this.source = 'banco';
    } else {
      this.accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      this.publicKey = process.env.MERCADOPAGO_PUBLIC_KEY ?? null;
      this.webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? null;
      this.source = this.accessToken ? 'variavel_de_ambiente' : 'nenhum';
    }

    this.preApproval = this.accessToken
      ? new PreApproval(
          new MercadoPagoConfig({ accessToken: this.accessToken }),
        )
      : null;
  }

  isConfigured(): boolean {
    return this.preApproval !== null;
  }

  getConfigStatus(): MercadoPagoConfigStatus {
    const apiBase = process.env.API_PUBLIC_URL || 'http://localhost:3000';
    return {
      configured: this.isConfigured(),
      source: this.source,
      accessTokenMasked: this.accessToken ? maskToken(this.accessToken) : null,
      publicKey: this.publicKey,
      webhookSecretSet: Boolean(this.webhookSecret),
      billingRedirectUrl: process.env.WEB_BILLING_REDIRECT_URL ?? null,
      webhookEndpointUrl: `${apiBase.replace(/\/$/, '')}/conta/assinatura/webhook/mercadopago`,
      nodeEnv: process.env.NODE_ENV ?? 'development',
    };
  }

  // Saves whichever fields were provided (omitting a field leaves it unchanged),
  // re-derives the live PreApproval client from the new token, and logs the change
  // for the audit trail shown in /admin/mercadopago.
  async updateConfig(
    dto: UpdateMercadoPagoConfigInput,
  ): Promise<MercadoPagoConfigStatus> {
    await this.prisma.platformSetting.upsert({
      where: { id: SETTING_ID },
      create: {
        id: SETTING_ID,
        accessToken: dto.accessToken
          ? this.encryptionService.encrypt(dto.accessToken)
          : null,
        publicKey: dto.publicKey ?? null,
        webhookSecret: dto.webhookSecret
          ? this.encryptionService.encrypt(dto.webhookSecret)
          : null,
      },
      update: {
        ...(dto.accessToken !== undefined
          ? { accessToken: this.encryptionService.encrypt(dto.accessToken) }
          : {}),
        ...(dto.publicKey !== undefined ? { publicKey: dto.publicKey } : {}),
        ...(dto.webhookSecret !== undefined
          ? { webhookSecret: this.encryptionService.encrypt(dto.webhookSecret) }
          : {}),
      },
    });

    await this.loadConfig();
    await this.log(
      MercadoPagoLogEvent.CONFIG_UPDATED,
      true,
      'Configuração do Mercado Pago atualizada pela equipe da plataforma',
    );

    return this.getConfigStatus();
  }

  private async log(
    event: MercadoPagoLogEvent,
    success: boolean,
    message: string,
    preapprovalId?: string,
  ) {
    try {
      await this.prisma.mercadoPagoLog.create({
        data: { event, success, message, preapprovalId },
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao registrar log do Mercado Pago: ${(err as Error).message}`,
      );
    }
  }

  getLogs(limit = 50) {
    return this.prisma.mercadoPagoLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Creates a recurring subscription (PreApproval) and returns the checkout URL the
  // payer must be redirected to in order to authorize the monthly charge.
  async createSubscription(input: CreatePreapprovalInput): Promise<{
    id: string;
    initPoint: string;
  }> {
    if (!this.preApproval) {
      await this.log(
        MercadoPagoLogEvent.CREATE_SUBSCRIPTION,
        false,
        'Tentativa de criar assinatura sem Mercado Pago configurado',
      );
      throw new Error(
        'Mercado Pago não está configurado (defina o token em /admin/mercadopago)',
      );
    }

    try {
      const result = await this.preApproval.create({
        body: {
          reason: input.reason,
          payer_email: input.payerEmail,
          external_reference: input.externalReference,
          back_url: input.backUrl,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: input.transactionAmount,
            currency_id: 'BRL',
          },
        },
      });

      if (!result.id || !result.init_point) {
        throw new Error(
          'Resposta inesperada do Mercado Pago ao criar assinatura',
        );
      }

      await this.log(
        MercadoPagoLogEvent.CREATE_SUBSCRIPTION,
        true,
        `Assinatura criada para ${input.payerEmail}`,
        result.id,
      );
      return { id: result.id, initPoint: result.init_point };
    } catch (err) {
      const message = (err as Error).message;
      await this.log(
        MercadoPagoLogEvent.CREATE_SUBSCRIPTION,
        false,
        `Falha ao criar assinatura para ${input.payerEmail}: ${message}`,
      );
      // O SDK do MP lança erros crus (ex.: "Invalid value for back_url") que virariam
      // um 500 genérico. Devolvemos 400 com a causa para a tela mostrar algo útil.
      if (message.toLowerCase().includes('back_url')) {
        throw new BadRequestException(
          'O Mercado Pago rejeitou a URL de retorno (back_url). Ele exige uma URL pública ' +
            '(https) — defina WEB_BILLING_REDIRECT_URL com a URL do painel em produção; ' +
            'localhost não é aceito.',
        );
      }
      throw new BadRequestException(`Erro do Mercado Pago: ${message}`);
    }
  }

  async cancelSubscription(preapprovalId: string): Promise<void> {
    if (!this.preApproval) return;
    try {
      await this.preApproval.update({
        id: preapprovalId,
        body: { status: 'cancelled' },
      });
      await this.log(
        MercadoPagoLogEvent.CANCEL_SUBSCRIPTION,
        true,
        'Assinatura cancelada',
        preapprovalId,
      );
    } catch (err) {
      this.logger.warn(
        `Falha ao cancelar assinatura ${preapprovalId} no Mercado Pago: ${(err as Error).message}`,
      );
      await this.log(
        MercadoPagoLogEvent.CANCEL_SUBSCRIPTION,
        false,
        `Falha ao cancelar: ${(err as Error).message}`,
        preapprovalId,
      );
    }
  }

  async getSubscription(preapprovalId: string) {
    if (!this.preApproval) return null;
    return this.preApproval.get({ id: preapprovalId });
  }

  // The SDK has no dedicated client for this resource, so we hit the REST API
  // directly: GET /authorized_payments/search?preapproval_id=... lists every
  // individual charge generated by a recurring PreApproval subscription.
  async getPaymentHistory(
    preapprovalId: string,
  ): Promise<PaymentHistoryEntry[]> {
    if (!this.accessToken) return [];
    try {
      const res = await fetch(
        `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );
      if (!res.ok) {
        this.logger.warn(
          `Mercado Pago respondeu ${res.status} ao buscar histórico de pagamentos de ${preapprovalId}`,
        );
        await this.log(
          MercadoPagoLogEvent.PAYMENT_HISTORY_FETCH,
          false,
          `Mercado Pago respondeu ${res.status}`,
          preapprovalId,
        );
        return [];
      }
      const data = (await res.json()) as {
        results?: {
          id: number;
          status: string;
          transaction_amount: number;
          currency_id: string;
          date_approved: string | null;
          date_created: string;
        }[];
      };
      return (data.results ?? []).map((p) => ({
        id: p.id,
        status: p.status,
        transactionAmount: p.transaction_amount,
        currencyId: p.currency_id,
        dateApproved: p.date_approved,
        dateCreated: p.date_created,
      }));
    } catch (err) {
      this.logger.warn(
        `Falha ao buscar histórico de pagamentos de ${preapprovalId}: ${(err as Error).message}`,
      );
      await this.log(
        MercadoPagoLogEvent.PAYMENT_HISTORY_FETCH,
        false,
        (err as Error).message,
        preapprovalId,
      );
      return [];
    }
  }

  // Verifica a assinatura HMAC dos webhooks conforme especificação do Mercado Pago:
  // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
  // Header `x-signature` vem no formato `ts=<timestamp>,v1=<hmacHex>`; o manifest
  // assinado é `id:<dataId>;request-id:<xRequestId>;ts:<timestamp>;` (HMAC-SHA256
  // com o webhookSecret). Sem secret configurado, retorna true — melhor deixar o
  // webhook rodar do que travar a sincronização de assinatura por config faltando.
  // A comparação usa timingSafeEqual para evitar timing attacks.
  verifyWebhookSignature(
    signatureHeader: string | undefined,
    requestId: string | undefined,
    dataId: string | undefined,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'Webhook do Mercado Pago recebido sem webhookSecret configurado — assinatura não pode ser verificada. Configure em /admin/mercadopago para produção.',
      );
      return true;
    }
    if (!signatureHeader || !dataId) return false;

    const parts = signatureHeader
      .split(',')
      .reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${requestId ?? ''};ts:${ts};`;
    const expected = createHmac('sha256', this.webhookSecret)
      .update(manifest)
      .digest('hex');

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(v1, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async recordWebhook(
    preapprovalId: string,
    success: boolean,
    message: string,
  ) {
    await this.log(
      MercadoPagoLogEvent.WEBHOOK,
      success,
      message,
      preapprovalId,
    );
  }
}
