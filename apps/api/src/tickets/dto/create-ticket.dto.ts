import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
