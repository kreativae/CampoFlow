import { Module } from '@nestjs/common';
import { HealthRecordsModule } from '../health-records/health-records.module';
import { AgendaModule } from '../agenda/agenda.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { WeatherModule } from '../weather/weather.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailDigestProcessor } from './email-digest.processor';

@Module({
  imports: [HealthRecordsModule, AgendaModule, SuppliesModule, WeatherModule],
  providers: [NotificationsService, EmailDigestProcessor],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
