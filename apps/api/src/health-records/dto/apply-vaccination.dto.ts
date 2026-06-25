import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ApplyVaccinationDto {
  @IsOptional()
  @IsDateString()
  administeredAt?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  administeredBy?: string;
}
