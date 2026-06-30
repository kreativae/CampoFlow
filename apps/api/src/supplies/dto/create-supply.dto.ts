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

  // Only meaningful when category is OUTROS — the customer's own label,
  // shown instead of the generic "Outros".
  @IsOptional()
  @IsString()
  customCategory?: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialQuantity?: number;

  // Optional at creation: the "Quantidade" field on the create form only sets
  // the starting stock. Defaults to 0 (alerts effectively off) until the
  // customer opts in via the edit form.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumQuantity?: number;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
