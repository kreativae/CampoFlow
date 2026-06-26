import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { SupplyMovementType } from '@prisma/client';

export class CreateMovementDto {
  @IsEnum(SupplyMovementType)
  type: SupplyMovementType;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
