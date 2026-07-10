-- CreateTable
CREATE TABLE "SoilAnalysisPhoto" (
    "id" TEXT NOT NULL,
    "soilAnalysisId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoilAnalysisPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SoilAnalysisPhoto" ADD CONSTRAINT "SoilAnalysisPhoto_soilAnalysisId_fkey" FOREIGN KEY ("soilAnalysisId") REFERENCES "SoilAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
