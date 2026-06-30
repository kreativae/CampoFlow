import { Module } from '@nestjs/common';
import { CropsService } from './crops.service';
import { CropsController } from './crops.controller';

@Module({
  providers: [CropsService],
  controllers: [CropsController],
  exports: [CropsService],
})
export class CropsModule {}
