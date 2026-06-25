import { Module } from '@nestjs/common';
import { ReproductionService } from './reproduction.service';
import { ReproductionController } from './reproduction.controller';

@Module({
  providers: [ReproductionService],
  controllers: [ReproductionController],
})
export class ReproductionModule {}
