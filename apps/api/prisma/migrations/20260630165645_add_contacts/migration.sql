-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');

-- CreateEnum
CREATE TYPE "ContactCategory" AS ENUM ('FORNECEDOR', 'CLIENTE', 'VETERINARIO', 'TRANSPORTADOR', 'COMPRADOR', 'PRESTADOR_SERVICO', 'OUTRO');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "category" "ContactCategory" NOT NULL DEFAULT 'OUTRO',
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "addressStreet" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
