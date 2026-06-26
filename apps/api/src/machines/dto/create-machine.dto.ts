import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { MachineType } from '@prisma/client';

export class CreateMachineDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(MachineType)
  type: MachineType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentHourMeter?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
