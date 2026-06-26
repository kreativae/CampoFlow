import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  userId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
