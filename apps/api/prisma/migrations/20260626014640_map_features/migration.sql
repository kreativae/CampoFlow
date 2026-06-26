-- CreateEnum
CREATE TYPE "MapFeatureType" AS ENUM ('CERCA', 'PASTAGEM', 'NASCENTE', 'RESERVA', 'OUTRO');

-- CreateEnum
CREATE TYPE "GeometryType" AS ENUM ('PONTO', 'POLIGONO');

-- CreateTable
CREATE TABLE "MapFeature" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MapFeatureType" NOT NULL,
    "geometryType" "GeometryType" NOT NULL,
    "coordinates" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapFeature_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MapFeature" ADD CONSTRAINT "MapFeature_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
