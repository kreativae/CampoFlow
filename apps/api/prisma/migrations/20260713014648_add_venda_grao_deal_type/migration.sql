-- AlterEnum
ALTER TYPE "DealType" ADD VALUE 'VENDA_GRAO';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "cropCycleId" TEXT,
ADD COLUMN     "grainCrop" TEXT,
ADD COLUMN     "grainGrossWeightKg" DOUBLE PRECISION,
ADD COLUMN     "grainImpurityPercent" DOUBLE PRECISION,
ADD COLUMN     "grainMoistureBasePercent" DOUBLE PRECISION,
ADD COLUMN     "grainMoistureDiscount" DOUBLE PRECISION,
ADD COLUMN     "grainMoisturePercent" DOUBLE PRECISION,
ADD COLUMN     "grainNetWeightKg" DOUBLE PRECISION,
ADD COLUMN     "grainQuantity" DOUBLE PRECISION,
ADD COLUMN     "grainSaleModality" TEXT,
ADD COLUMN     "grainTicketRef" TEXT,
ADD COLUMN     "grainUnit" TEXT,
ADD COLUMN     "grainWarehouse" TEXT;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
