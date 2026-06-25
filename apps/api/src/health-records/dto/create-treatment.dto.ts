import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTreatmentDto {
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsString()
  @MinLength(1)
  medication: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsDateString()
  treatmentDate?: string;

  @IsOptional()
  @IsString()
  administeredBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
