import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CropCostCategory } from '@prisma/client';

export class CreateCropCostEntryDto {
  @IsEnum(CropCostCategory)
  category: CropCostCategory;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsDateString()
  incurredAt?: string;
}
