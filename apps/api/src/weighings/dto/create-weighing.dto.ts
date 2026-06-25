import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateWeighingDto {
  @IsNumber()
  @Min(0.1)
  weightKg: number;

  @IsOptional()
  @IsDateString()
  weighedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
