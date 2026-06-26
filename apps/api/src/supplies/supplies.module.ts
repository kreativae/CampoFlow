import { Module } from '@nestjs/common';
import { SuppliesService } from './supplies.service';
import { SuppliesController } from './supplies.controller';

@Module({
  providers: [SuppliesService],
  controllers: [SuppliesController],
})
export class SuppliesModule {}
