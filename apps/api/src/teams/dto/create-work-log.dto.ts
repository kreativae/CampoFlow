import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWorkLogDto {
  @IsString()
  @MinLength(1)
  description: string;

  @IsNumber()
  @Min(0.1)
  hoursWorked: number;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
