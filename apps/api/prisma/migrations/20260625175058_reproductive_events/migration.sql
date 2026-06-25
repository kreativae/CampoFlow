-- CreateEnum
CREATE TYPE "ReproductiveEventType" AS ENUM ('IATF', 'MONTA_NATURAL', 'INSEMINACAO', 'DIAGNOSTICO_PRENHEZ', 'PARTO', 'ABORTO');

-- CreateEnum
CREATE TYPE "PregnancyDiagnosisResult" AS ENUM ('PRENHE', 'VAZIA');

-- CreateTable
CREATE TABLE "ReproductiveEvent" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "ReproductiveEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "PregnancyDiagnosisResult",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReproductiveEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReproductiveEvent" ADD CONSTRAINT "ReproductiveEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
