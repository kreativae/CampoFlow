import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { SupplyCategory } from '@prisma/client';

export class CreateSupplyDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(SupplyCategory)
  category: SupplyCategory;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialQuantity?: number;

  @IsNumber()
  @Min(0)
  minimumQuantity: number;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
