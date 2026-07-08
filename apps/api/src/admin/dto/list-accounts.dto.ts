import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

export class ListAccountsDto {
  // Busca por nome da conta, e-mail de cobrança ou e-mail de um usuário da conta.
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(PlanTier)
  planTier?: PlanTier;

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
  pageSize?: number = 20;
}
