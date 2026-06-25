import { Module } from '@nestjs/common';
import { HealthRecordsService } from './health-records.service';
import { HealthRecordsController } from './health-records.controller';

@Module({
  providers: [HealthRecordsService],
  controllers: [HealthRecordsController],
})
export class HealthRecordsModule {}
