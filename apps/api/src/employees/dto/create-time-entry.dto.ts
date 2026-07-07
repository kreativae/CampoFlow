import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTimeEntryDto {
  @IsString()
  description: string;

  // Positivo = horas trabalhadas/crédito; negativo = folga/débito no banco de horas.
  @IsNumber()
  hours: number;

  // Marca que essas horas já foram pagas — abatem do custo em aberto.
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
