import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SupplyMovementType } from '@prisma/client';

export class UpdateMovementDto {
  @IsOptional()
  @IsEnum(SupplyMovementType)
  type?: SupplyMovementType;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
