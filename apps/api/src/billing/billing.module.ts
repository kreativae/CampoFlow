import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  providers: [BillingService, MercadoPagoService],
  controllers: [BillingController],
  exports: [BillingService, MercadoPagoService],
})
export class BillingModule {}
