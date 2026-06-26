import { Module } from '@nestjs/common';
import { SoilAnalysisService } from './soil-analysis.service';
import { SoilAnalysisController } from './soil-analysis.controller';

@Module({
  providers: [SoilAnalysisService],
  controllers: [SoilAnalysisController],
})
export class SoilAnalysisModule {}
