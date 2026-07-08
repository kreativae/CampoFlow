import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { MercadoPagoService } from './mercadopago.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('conta/assinatura')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getForAccount(user.accountId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.billingService.startCheckout(
      user.accountId,
      user.email,
      dto.planTier,
    );
  }

  @Post('cancelar')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.cancel(user.accountId);
  }

  // Endpoint público: o Mercado Pago chama direto, sem header de auth. Autenticamos
  // via HMAC (x-signature + x-request-id), conforme especificação do MP. Sem essa
  // verificação, um POST forjado poderia disparar handleWebhook e mexer no estado
  // da assinatura. O handler ainda re-consulta o MP pelo id em vez de confiar no
  // corpo, mas a HMAC é a barreira principal.
  @Post('webhook/mercadopago')
  async webhook(
    @Query('id') queryId: string,
    @Query('data.id') queryDataId: string,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const data = body?.data as { id?: string } | undefined;
    const preapprovalId = data?.id ?? queryDataId ?? queryId;

    if (
      !this.mercadoPagoService.verifyWebhookSignature(
        signature,
        requestId,
        preapprovalId,
      )
    ) {
      await this.mercadoPagoService.recordWebhook(
        preapprovalId ?? 'desconhecido',
        false,
        'Assinatura HMAC inválida — webhook rejeitado',
      );
      throw new ForbiddenException('Assinatura inválida');
    }

    if (preapprovalId) {
      await this.billingService.handleWebhook(preapprovalId);
    }
    return { received: true };
  }
}
