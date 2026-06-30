import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  notes?: string;
}
