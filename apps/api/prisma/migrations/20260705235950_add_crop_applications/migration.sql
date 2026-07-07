-- CreateEnum
CREATE TYPE "CropApplicationType" AS ENUM ('PLANTIO', 'ADUBACAO', 'CALAGEM', 'HERBICIDA', 'FUNGICIDA', 'INSETICIDA', 'DEFENSIVO', 'IRRIGACAO', 'OUTRO');

-- CreateTable
CREATE TABLE "CropApplication" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropCycleId" TEXT NOT NULL,
    "type" "CropApplicationType" NOT NULL,
    "product" TEXT NOT NULL,
    "dosePerHa" DOUBLE PRECISION,
    "doseUnit" TEXT,
    "totalQuantity" DOUBLE PRECISION,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preHarvestIntervalDays" INTEGER,
    "responsible" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropApplication_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CropApplication" ADD CONSTRAINT "CropApplication_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropApplication" ADD CONSTRAINT "CropApplication_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "CropCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
