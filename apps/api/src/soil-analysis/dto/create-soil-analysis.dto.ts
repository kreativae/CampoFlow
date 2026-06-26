import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSoilAnalysisDto {
  @IsOptional()
  @IsUUID()
  mapFeatureId?: string;

  @IsOptional()
  @IsString()
  areaLabel?: string;

  @IsDateString()
  collectedAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ph?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  phosphorusMgDm3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  potassiumCmolcDm3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  calciumCmolcDm3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  magnesiumCmolcDm3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  aluminumCmolcDm3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  organicMatterPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  baseSaturationPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ctcCmolcDm3?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
