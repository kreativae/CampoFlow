import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Commodity } from '@prisma/client';

export class CreateQuotationDto {
  @IsEnum(Commodity)
  commodity: Commodity;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
