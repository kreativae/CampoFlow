-- DropForeignKey
ALTER TABLE "MachineFuelRecord" DROP CONSTRAINT "MachineFuelRecord_machineId_fkey";

-- DropForeignKey
ALTER TABLE "MachineMaintenance" DROP CONSTRAINT "MachineMaintenance_machineId_fkey";

-- DropForeignKey
ALTER TABLE "PastureOccupation" DROP CONSTRAINT "PastureOccupation_pastureId_fkey";

-- DropForeignKey
ALTER TABLE "SupplyMovement" DROP CONSTRAINT "SupplyMovement_supplyId_fkey";

-- AddForeignKey
ALTER TABLE "PastureOccupation" ADD CONSTRAINT "PastureOccupation_pastureId_fkey" FOREIGN KEY ("pastureId") REFERENCES "Pasture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyMovement" ADD CONSTRAINT "SupplyMovement_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "Supply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineMaintenance" ADD CONSTRAINT "MachineMaintenance_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineFuelRecord" ADD CONSTRAINT "MachineFuelRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
