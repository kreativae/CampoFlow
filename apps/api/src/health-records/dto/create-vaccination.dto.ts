import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVaccinationDto {
  @IsString()
  @MinLength(1)
  vaccineName: string;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsDateString()
  administeredAt?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  administeredBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
