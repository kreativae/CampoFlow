-- CreateEnum
CREATE TYPE "MercadoPagoLogEvent" AS ENUM ('CREATE_SUBSCRIPTION', 'CANCEL_SUBSCRIPTION', 'WEBHOOK', 'PAYMENT_HISTORY_FETCH', 'CONFIG_UPDATED');

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'mercadopago',
    "accessToken" TEXT,
    "publicKey" TEXT,
    "webhookSecret" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MercadoPagoLog" (
    "id" TEXT NOT NULL,
    "event" "MercadoPagoLogEvent" NOT NULL,
    "preapprovalId" TEXT,
    "success" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MercadoPagoLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MercadoPagoLog_createdAt_idx" ON "MercadoPagoLog"("createdAt");
