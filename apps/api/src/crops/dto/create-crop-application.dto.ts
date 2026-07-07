import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CropApplicationType } from '@prisma/client';

export class CreateCropApplicationDto {
  @IsEnum(CropApplicationType)
  type: CropApplicationType;

  @IsString()
  product: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dosePerHa?: number;

  @IsOptional()
  @IsString()
  doseUnit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  // Preço unitário do produto (R$ por unidade da dose/quantidade) para custo.
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsDateString()
  appliedAt?: string;

  // Carência (dias) até a colheita.
  @IsOptional()
  @IsInt()
  @Min(0)
  preHarvestIntervalDays?: number;

  @IsOptional()
  @IsString()
  responsible?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
