import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AnimalCategory, AnimalSex } from '@prisma/client';

export class CreateAnimalDto {
  @IsString()
  @MinLength(1)
  earTag: string;

  @IsOptional()
  @IsString()
  rfid?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(AnimalSex)
  sex: AnimalSex;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsEnum(AnimalCategory)
  category: AnimalCategory;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsNumber()
  currentWeightKg?: number;

  @IsOptional()
  @IsString()
  pastureId?: string;
}
