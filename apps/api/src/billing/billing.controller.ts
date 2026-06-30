import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('conta/assinatura')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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

  // Public endpoint: Mercado Pago calls this directly, with no auth header. The
  // handler re-fetches the resource from MP's API by id rather than trusting the
  // webhook body, so an unauthenticated POST here can't be used to forge state.
  @Post('webhook/mercadopago')
  async webhook(
    @Query('id') queryId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const data = body?.data as { id?: string } | undefined;
    const preapprovalId = data?.id ?? queryId;
    if (preapprovalId) {
      await this.billingService.handleWebhook(preapprovalId);
    }
    return { received: true };
  }
}
