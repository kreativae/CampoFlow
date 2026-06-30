import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { FarmsService } from './farms.service';
import { FarmsController } from './farms.controller';
import { InvitesController } from './invites.controller';

@Module({
  imports: [BillingModule],
  providers: [FarmsService],
  controllers: [FarmsController, InvitesController],
  exports: [FarmsService],
})
export class FarmsModule {}
