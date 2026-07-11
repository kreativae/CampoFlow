import { PlanTier } from '@prisma/client';

export interface PlanDefinition {
  tier: PlanTier;
  label: string;
  maxFarms: number | null;
  priceBRL: number | null;
  // Stripe Price ID para o plano (configurado em STRIPE_PRICE_ID_BASICO, etc.)
  stripePriceId: string | null;
}

// Single source of truth for plan limits/pricing. The user asked specifically for
// the limit to kick in "a partir de 3 fazendas" — TRIAL and BASICO both cap at 2
// farms, so creating a 3rd farm requires upgrading to PROFISSIONAL or above.
export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  TRIAL: {
    tier: 'TRIAL',
    label: 'Teste gratuito (30 dias)',
    maxFarms: 2,
    priceBRL: 0,
    stripePriceId: null,
  },
  BASICO: {
    tier: 'BASICO',
    label: 'Básico',
    maxFarms: 2,
    priceBRL: 99.9,
    stripePriceId: process.env.STRIPE_PRICE_ID_BASICO ?? null,
  },
  PROFISSIONAL: {
    tier: 'PROFISSIONAL',
    label: 'Profissional',
    maxFarms: 10,
    priceBRL: 299.9,
    stripePriceId: process.env.STRIPE_PRICE_ID_PROFISSIONAL ?? null,
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    label: 'Enterprise',
    maxFarms: null,
    priceBRL: null,
    stripePriceId: null,
  },
};

export const TRIAL_DURATION_DAYS = 30;

// Statuses that allow normal write access to the platform.
export const ACTIVE_SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE'] as const;

// LGPD-aligned retention: once a subscription is CANCELED, the account keeps full
// read/export access (and can resubscribe to regain write access — see
// JwtAuthGuard) for this many days. After that, farm data is purged for good — see
// FarmsService.purgeCanceledAccountsData(). The User/Account rows themselves are
// kept (so the person can still log in and see why their data is gone) rather than
// deleted outright.
export const CANCELED_DATA_RETENTION_DAYS = 30;
