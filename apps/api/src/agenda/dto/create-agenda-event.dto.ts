import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AgendaEventType } from '@prisma/client';

export class CreateAgendaEventDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsEnum(AgendaEventType)
  type: AgendaEventType;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
