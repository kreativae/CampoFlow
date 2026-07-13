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
  @IsEnum(['COMPRA', 'VENDA', 'ABATE', 'VENDA_GRAO'])
  type: 'COMPRA' | 'VENDA' | 'ABATE' | 'VENDA_GRAO';

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

  // Venda de grãos
  @IsOptional()
  @IsString()
  grainCrop?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grainQuantity?: number;

  @IsOptional()
  @IsString()
  grainUnit?: string;

  @IsOptional()
  @IsNumber()
  grainMoisturePercent?: number;

  @IsOptional()
  @IsNumber()
  grainMoistureBasePercent?: number;

  @IsOptional()
  @IsNumber()
  grainImpurityPercent?: number;

  @IsOptional()
  @IsNumber()
  grainMoistureDiscount?: number;

  @IsOptional()
  @IsNumber()
  grainGrossWeightKg?: number;

  @IsOptional()
  @IsNumber()
  grainNetWeightKg?: number;

  @IsOptional()
  @IsString()
  grainSaleModality?: string;

  @IsOptional()
  @IsString()
  grainWarehouse?: string;

  @IsOptional()
  @IsString()
  grainTicketRef?: string;

  @IsOptional()
  @IsString()
  cropCycleId?: string;

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
