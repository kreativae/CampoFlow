import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  PregnancyDiagnosisResult,
  ReproductiveEventType,
} from '@prisma/client';

export class CreateReproductiveEventDto {
  @IsEnum(ReproductiveEventType)
  type: ReproductiveEventType;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  // Only meaningful when type is DIAGNOSTICO_PRENHEZ.
  @IsOptional()
  @IsEnum(PregnancyDiagnosisResult)
  result?: PregnancyDiagnosisResult;

  @IsOptional()
  @IsString()
  notes?: string;
}
