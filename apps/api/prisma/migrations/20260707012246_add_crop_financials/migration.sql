-- CreateEnum
CREATE TYPE "CropSaleUnit" AS ENUM ('SACA60', 'KG', 'ARROBA');

-- CreateEnum
CREATE TYPE "CropCostCategory" AS ENUM ('SEMENTE', 'FERTILIZANTE', 'DEFENSIVO', 'CALCARIO', 'OPERACAO', 'MAO_DE_OBRA', 'ARRENDAMENTO', 'OUTRO');

-- AlterTable
ALTER TABLE "CropApplication" ADD COLUMN     "unitPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CropCycle" ADD COLUMN     "salePricePerUnit" DOUBLE PRECISION,
ADD COLUMN     "saleUnit" "CropSaleUnit";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cropCycleId" TEXT;

-- CreateTable
CREATE TABLE "CropCostEntry" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropCycleId" TEXT NOT NULL,
    "category" "CropCostCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropCostEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCostEntry" ADD CONSTRAINT "CropCostEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCostEntry" ADD CONSTRAINT "CropCostEntry_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "CropCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
