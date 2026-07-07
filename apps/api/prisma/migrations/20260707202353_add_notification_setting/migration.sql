-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "frequency" TEXT NOT NULL DEFAULT 'HOURLY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

