-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('TRIAL', 'BASICO', 'PROFISSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "document" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "planTier" "PlanTier" NOT NULL DEFAULT 'TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "mercadoPagoPreapprovalId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_accountId_key" ON "Subscription"("accountId");

-- AlterTable: add as nullable first so existing rows can be backfilled below.
ALTER TABLE "User" ADD COLUMN "accountId" TEXT;
ALTER TABLE "User" ADD COLUMN "isAccountAdmin" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Farm" ADD COLUMN "accountId" TEXT;

-- Data backfill (pre-launch dev data): one Account per existing User, each owning
-- a fresh 30-day TRIAL subscription. Farms get the accountId of their first OWNER
-- membership (fallback: any membership) so existing farm access keeps working.
DO $$
DECLARE
  user_row RECORD;
  new_account_id TEXT;
BEGIN
  FOR user_row IN SELECT id FROM "User" WHERE "accountId" IS NULL LOOP
    new_account_id := gen_random_uuid()::text;

    INSERT INTO "Account" (id, name, "billingEmail", "createdAt", "updatedAt")
    SELECT new_account_id, COALESCE(u.name, u.email) || ' - Conta', u.email, now(), now()
    FROM "User" u WHERE u.id = user_row.id;

    UPDATE "User" SET "accountId" = new_account_id WHERE id = user_row.id;

    INSERT INTO "Subscription" (id, "accountId", "planTier", status, "trialEndsAt", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, new_account_id, 'TRIAL', 'TRIALING', now() + interval '30 days', now(), now());
  END LOOP;
END $$;

UPDATE "Farm" f
SET "accountId" = owner_account."accountId"
FROM (
  SELECT DISTINCT ON (m."farmId") m."farmId", u."accountId"
  FROM "Membership" m
  JOIN "User" u ON u.id = m."userId"
  ORDER BY m."farmId", (m.role = 'OWNER') DESC, m."createdAt" ASC
) AS owner_account
WHERE f.id = owner_account."farmId" AND f."accountId" IS NULL;

-- AlterTable: now that every row is backfilled, enforce NOT NULL.
ALTER TABLE "User" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Farm" ALTER COLUMN "accountId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
