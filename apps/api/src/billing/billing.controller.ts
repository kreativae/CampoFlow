import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateStripeConfigInput } from './stripe.service';

@Controller('conta/assinatura')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly stripeService: StripeService,
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

  // Endpoint público — o Stripe envia sem header de auth.
  // Verificamos via assinatura HMAC do Stripe (stripe-signature header).
  // O body precisa ser raw (Buffer) para a verificação funcionar.
  @Post('webhook/stripe')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const payload = req.rawBody;
    if (!payload) {
      throw new ForbiddenException('Payload vazio');
    }
    await this.billingService.handleWebhook(payload, signature ?? '');
    return { received: true };
  }

  // Admin: status da configuração Stripe
  @Get('admin/stripe')
  @UseGuards(JwtAuthGuard)
  getStripeConfig() {
    return this.stripeService.getConfigStatus();
  }

  // Admin: salvar chaves do Stripe
  @Post('admin/stripe')
  @UseGuards(JwtAuthGuard)
  updateStripeConfig(@Body() dto: UpdateStripeConfigInput) {
    return this.stripeService.updateConfig(dto);
  }
}
