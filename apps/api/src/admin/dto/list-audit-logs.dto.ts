import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAuditLogsDto {
  // Busca por e-mail do usuário ou por trecho do caminho (path).
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 50;
}
