import { Module } from '@nestjs/common';
import { WeighingsService } from './weighings.service';
import { WeighingsController } from './weighings.controller';

@Module({
  providers: [WeighingsService],
  controllers: [WeighingsController],
})
export class WeighingsModule {}
