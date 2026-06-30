import { IsEnum, IsOptional } from 'class-validator';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

// Manual override used by platform staff for support cases (comp accounts, fixing a
// stuck webhook, granting a discount plan, etc.) — bypasses Mercado Pago entirely.
export class UpdateSubscriptionDto {
  @IsOptional()
  @IsEnum(PlanTier)
  planTier?: PlanTier;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}
