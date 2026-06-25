import { IsIn, IsOptional } from 'class-validator';

export class CashFlowQueryDto {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  granularity?: 'daily' | 'weekly' | 'monthly';
}
