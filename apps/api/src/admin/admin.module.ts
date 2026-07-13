import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { FarmsModule } from '../farms/farms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [BillingModule, FarmsModule, NotificationsModule, QuotationsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
