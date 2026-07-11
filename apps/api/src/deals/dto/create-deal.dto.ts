import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class DealItemDto {
  @IsOptional()
  @IsString()
  animalId?: string;

  @IsString()
  earTag: string;

  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}

export class CreateDealDto {
  @IsEnum(['COMPRA', 'VENDA', 'ABATE'])
  type: 'COMPRA' | 'VENDA';

  @IsOptional()
  @IsString()
  counterparty?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerUnit?: number;

  // Compra em lote (sem brincos individuais)
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  installmentCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  installmentValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalValue?: number;

  @IsOptional()
  @IsString()
  priceUnit?: string;

  // Abate
  @IsOptional()
  @IsNumber()
  @Min(0)
  carcassYieldPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  liveWeightPricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  funruralPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  senarPercent?: number;

  @IsOptional()
  @IsString()
  slaughterFrequency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freightCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  dealDate: string;

  // Opcional: compra em lote usa apenas quantity; venda importa brincos.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DealItemDto)
  items?: DealItemDto[];
}
