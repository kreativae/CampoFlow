import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
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
  @IsEnum(['COMPRA', 'VENDA'])
  type: 'COMPRA' | 'VENDA';

  @IsOptional()
  @IsString()
  counterparty?: string;

  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  @IsOptional()
  @IsString()
  priceUnit?: string;

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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DealItemDto)
  items: DealItemDto[];
}
