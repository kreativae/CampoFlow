import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BrazilianState, Commodity } from '@prisma/client';

export class CreateQuotationDto {
  @IsEnum(Commodity)
  commodity: Commodity;

  // Null/omitted means a national/aggregate quote (e.g. the automatic Redação
  // Agro feed); set it to break the quote down by state, like a regional table.
  @IsOptional()
  @IsEnum(BrazilianState)
  state?: BrazilianState;

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
