import { PartialType } from '@nestjs/mapped-types';
import { CreateCropCostEntryDto } from './create-crop-cost-entry.dto';

export class UpdateCropCostEntryDto extends PartialType(
  CreateCropCostEntryDto,
) {}
