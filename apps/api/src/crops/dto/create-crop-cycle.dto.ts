import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CropSaleUnit } from '@prisma/client';

export class CreateCropCycleDto {
  @IsOptional()
  @ValidateIf((o: CreateCropCycleDto) => o.mapFeatureId !== null)
  @IsUUID()
  mapFeatureId?: string | null;

  @IsString()
  cropName: string;

  @IsOptional()
  @IsString()
  variety?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  areaHectares?: number;

  @IsDateString()
  plantedAt: string;

  @IsOptional()
  @IsDateString()
  expectedHarvestAt?: string;

  @IsOptional()
  @IsDateString()
  harvestedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yieldKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePricePerUnit?: number;

  @IsOptional()
  @IsEnum(CropSaleUnit)
  saleUnit?: CropSaleUnit;

  @IsOptional()
  @IsString()
  notes?: string;
}
