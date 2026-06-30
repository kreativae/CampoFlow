import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { FarmsModule } from '../farms/farms.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [BillingModule, FarmsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
