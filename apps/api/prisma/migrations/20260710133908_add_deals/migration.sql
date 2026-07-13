-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('COMPRA', 'VENDA');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('RASCUNHO', 'FINALIZADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "DealType" NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'RASCUNHO',
    "counterparty" TEXT,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "priceUnit" TEXT NOT NULL DEFAULT 'ANIMAL',
    "freightCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "dealDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "animalId" TEXT,
    "earTag" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,

    CONSTRAINT "DealItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_farmId_dealDate_idx" ON "Deal"("farmId", "dealDate");

-- CreateIndex
CREATE INDEX "DealItem_dealId_idx" ON "DealItem"("dealId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
