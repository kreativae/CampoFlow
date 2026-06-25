-- CreateEnum
CREATE TYPE "FarmType" AS ENUM ('FAZENDA', 'SITIO', 'CHACARA', 'CONFINAMENTO', 'ARRENDAMENTO');

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "registryNumber" TEXT,
ADD COLUMN     "technicalManager" TEXT,
ADD COLUMN     "totalAreaHectares" DOUBLE PRECISION,
ADD COLUMN     "type" "FarmType" NOT NULL DEFAULT 'FAZENDA',
ADD COLUMN     "usableAreaHectares" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Pasture" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaHectares" DOUBLE PRECISION NOT NULL,
    "grassType" TEXT,
    "animalCapacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pasture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastureOccupation" (
    "id" TEXT NOT NULL,
    "pastureId" TEXT NOT NULL,
    "headCount" INTEGER NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PastureOccupation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Pasture" ADD CONSTRAINT "Pasture_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastureOccupation" ADD CONSTRAINT "PastureOccupation_pastureId_fkey" FOREIGN KEY ("pastureId") REFERENCES "Pasture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
