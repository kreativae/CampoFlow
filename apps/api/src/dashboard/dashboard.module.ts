import { Module } from '@nestjs/common';
import { AnimalsModule } from '../animals/animals.module';
import { WeighingsModule } from '../weighings/weighings.module';
import { PasturesModule } from '../pastures/pastures.module';
import { FinanceModule } from '../finance/finance.module';
import { HealthRecordsModule } from '../health-records/health-records.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    AnimalsModule,
    WeighingsModule,
    PasturesModule,
    FinanceModule,
    HealthRecordsModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
