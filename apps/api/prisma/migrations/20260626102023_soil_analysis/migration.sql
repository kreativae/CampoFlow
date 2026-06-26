-- CreateTable
CREATE TABLE "SoilAnalysis" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "mapFeatureId" TEXT,
    "areaLabel" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "ph" DOUBLE PRECISION,
    "phosphorusMgDm3" DOUBLE PRECISION,
    "potassiumCmolcDm3" DOUBLE PRECISION,
    "calciumCmolcDm3" DOUBLE PRECISION,
    "magnesiumCmolcDm3" DOUBLE PRECISION,
    "aluminumCmolcDm3" DOUBLE PRECISION,
    "organicMatterPercent" DOUBLE PRECISION,
    "baseSaturationPercent" DOUBLE PRECISION,
    "ctcCmolcDm3" DOUBLE PRECISION,
    "documentPath" TEXT,
    "documentFileName" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoilAnalysis_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_mapFeatureId_fkey" FOREIGN KEY ("mapFeatureId") REFERENCES "MapFeature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
