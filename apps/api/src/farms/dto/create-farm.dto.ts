import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { FarmType } from '@prisma/client';

export class CreateFarmDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsEnum(FarmType)
  type?: FarmType;

  @IsOptional()
  @IsNumber()
  totalAreaHectares?: number;

  @IsOptional()
  @IsNumber()
  usableAreaHectares?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  registryNumber?: string;

  @IsOptional()
  @IsString()
  technicalManager?: string;
}
