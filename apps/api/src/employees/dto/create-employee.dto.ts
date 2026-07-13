import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EmployeeType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(EmployeeType)
  type?: EmployeeType;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
