import { Module } from '@nestjs/common';
import { AnimalsModule } from '../animals/animals.module';
import { WeighingsModule } from '../weighings/weighings.module';
import { PasturesModule } from '../pastures/pastures.module';
import { FinanceModule } from '../finance/finance.module';
import { HealthRecordsModule } from '../health-records/health-records.module';
import { FarmsModule } from '../farms/farms.module';
import { ReproductionModule } from '../reproduction/reproduction.module';
import { WeatherModule } from '../weather/weather.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { MachinesModule } from '../machines/machines.module';
import { TeamsModule } from '../teams/teams.module';
import { AgendaModule } from '../agenda/agenda.module';
import { MapFeaturesModule } from '../map-features/map-features.module';
import { SoilAnalysisModule } from '../soil-analysis/soil-analysis.module';
import { CropsModule } from '../crops/crops.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    AnimalsModule,
    WeighingsModule,
    PasturesModule,
    FinanceModule,
    HealthRecordsModule,
    FarmsModule,
    ReproductionModule,
    WeatherModule,
    SuppliesModule,
    MachinesModule,
    TeamsModule,
    AgendaModule,
    MapFeaturesModule,
    SoilAnalysisModule,
    CropsModule,
    DocumentsModule,
    NotificationsModule,
    QuotationsModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
