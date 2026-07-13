import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeService } from './stripe.service';

@Module({
  providers: [BillingService, StripeService],
  controllers: [BillingController],
  exports: [BillingService, StripeService],
})
export class BillingModule {}
