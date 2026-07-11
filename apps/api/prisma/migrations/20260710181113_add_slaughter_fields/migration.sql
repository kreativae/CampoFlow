-- AlterEnum
ALTER TYPE "DealType" ADD VALUE 'ABATE';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "carcassYieldPercent" DOUBLE PRECISION,
ADD COLUMN     "funruralPercent" DOUBLE PRECISION,
ADD COLUMN     "liveWeightPricePerKg" DOUBLE PRECISION,
ADD COLUMN     "senarPercent" DOUBLE PRECISION,
ADD COLUMN     "slaughterFrequency" TEXT;
