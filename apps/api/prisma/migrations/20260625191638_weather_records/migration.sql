-- CreateEnum
CREATE TYPE "WeatherAlertType" AS ENUM ('GEADA', 'TEMPESTADE', 'GRANIZO', 'SECA', 'VENTO_FORTE');

-- CreateTable
CREATE TABLE "WeatherRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "temperatureC" DOUBLE PRECISION,
    "humidityPercent" DOUBLE PRECISION,
    "windSpeedKmh" DOUBLE PRECISION,
    "pressureHpa" DOUBLE PRECISION,
    "rainfallMm" DOUBLE PRECISION,
    "alertType" "WeatherAlertType",
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeatherRecord" ADD CONSTRAINT "WeatherRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
