-- CreateEnum
CREATE TYPE "AnimalSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AnimalCategory" AS ENUM ('BEZERRO', 'BEZERRA', 'NOVILHO', 'NOVILHA', 'GARROTE', 'BOI', 'VACA', 'TOURO', 'MATRIZ');

-- CreateEnum
CREATE TYPE "AnimalEventType" AS ENUM ('TRANSFER', 'WEIGHING', 'VACCINATION', 'TREATMENT', 'REPRODUCTIVE', 'SALE', 'DEATH');

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "pastureId" TEXT,
    "earTag" TEXT NOT NULL,
    "rfid" TEXT,
    "name" TEXT,
    "sex" "AnimalSex" NOT NULL,
    "breed" TEXT,
    "category" "AnimalCategory" NOT NULL,
    "birthDate" TIMESTAMP(3),
    "currentWeightKg" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalEvent" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "AnimalEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_farmId_earTag_key" ON "Animal"("farmId", "earTag");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_pastureId_fkey" FOREIGN KEY ("pastureId") REFERENCES "Pasture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
