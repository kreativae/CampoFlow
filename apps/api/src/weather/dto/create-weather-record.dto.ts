import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { WeatherAlertType } from '@prisma/client';

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
  @IsEnum(WeatherAlertType)
  alertType?: WeatherAlertType;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
