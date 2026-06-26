import { Module } from '@nestjs/common';
import { AnimalsModule } from '../animals/animals.module';
import { WeighingsModule } from '../weighings/weighings.module';
import { FinanceModule } from '../finance/finance.module';
import { PasturesModule } from '../pastures/pastures.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { AgendaModule } from '../agenda/agenda.module';
import { HealthRecordsModule } from '../health-records/health-records.module';
import { WeatherModule } from '../weather/weather.module';
import { BiService } from './bi.service';
import { BiController } from './bi.controller';

@Module({
  imports: [
    AnimalsModule,
    WeighingsModule,
    FinanceModule,
    PasturesModule,
    SuppliesModule,
    AgendaModule,
    HealthRecordsModule,
    WeatherModule,
  ],
  providers: [BiService],
  controllers: [BiController],
})
export class BiModule {}
