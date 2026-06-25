import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Commodity } from '@prisma/client';

export class HistoryQueryDto {
  @IsOptional()
  @IsEnum(Commodity)
  commodity?: Commodity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
