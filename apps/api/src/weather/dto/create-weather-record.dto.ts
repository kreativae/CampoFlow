import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateWeatherRecordDto {
  @IsOptional()
  @IsNumber()
  temperatureC?: number;

  @IsOptional()
  @IsNumber()
  humidityPercent?: number;

  @IsOptional()
  @IsNumber()
  windSpeedKmh?: number;

  @IsOptional()
  @IsNumber()
  pressureHpa?: number;

  @IsOptional()
  @IsNumber()
  rainfallMm?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
