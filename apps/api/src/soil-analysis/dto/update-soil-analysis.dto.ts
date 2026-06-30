import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateSoilAnalysisDto } from './create-soil-analysis.dto';

export class UpdateSoilAnalysisDto extends PartialType(
  OmitType(CreateSoilAnalysisDto, ['mapFeatureId'] as const),
) {}
