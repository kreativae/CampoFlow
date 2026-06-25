-- CreateEnum
CREATE TYPE "Commodity" AS ENUM ('BOI_GORDO', 'VACA_GORDA', 'NOVILHA', 'BEZERRO', 'REPOSICAO', 'COURO', 'SEBO', 'LEITE', 'MILHO', 'SOJA', 'SORGO', 'FARELO_SOJA');

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "commodity" "Commodity" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);
