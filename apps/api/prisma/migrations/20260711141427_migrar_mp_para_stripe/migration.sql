/*
  Warnings:

  - You are about to drop the column `mercadoPagoPreapprovalId` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PlatformSetting" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "mercadoPagoPreapprovalId",
ADD COLUMN     "stripeSubscriptionId" TEXT;
