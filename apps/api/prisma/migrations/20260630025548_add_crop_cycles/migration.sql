-- CreateTable
CREATE TABLE "CropCycle" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "mapFeatureId" TEXT,
    "cropName" TEXT NOT NULL,
    "variety" TEXT,
    "areaHectares" DOUBLE PRECISION,
    "plantedAt" TIMESTAMP(3) NOT NULL,
    "expectedHarvestAt" TIMESTAMP(3),
    "harvestedAt" TIMESTAMP(3),
    "yieldKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropCycle_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_mapFeatureId_fkey" FOREIGN KEY ("mapFeatureId") REFERENCES "MapFeature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
