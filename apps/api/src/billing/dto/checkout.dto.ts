import { IsIn } from 'class-validator';

export class CheckoutDto {
  @IsIn(['BASICO', 'PROFISSIONAL'])
  planTier: 'BASICO' | 'PROFISSIONAL';
}
