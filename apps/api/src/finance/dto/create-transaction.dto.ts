import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TransactionCategory, TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  // Vincula o lançamento a uma safra, para entrar no fechamento dela.
  @IsOptional()
  @IsString()
  cropCycleId?: string;
}
