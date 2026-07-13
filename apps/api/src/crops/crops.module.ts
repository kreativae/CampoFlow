import { Module } from '@nestjs/common';
import { CropsService } from './crops.service';
import { CropsController } from './crops.controller';
import { SoilAnalysisModule } from '../soil-analysis/soil-analysis.module';

@Module({
  imports: [SoilAnalysisModule],
  providers: [CropsService],
  controllers: [CropsController],
  exports: [CropsService],
})
export class CropsModule {}
