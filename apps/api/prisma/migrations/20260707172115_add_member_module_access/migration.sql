-- AlterTable
ALTER TABLE "FarmInvite" ADD COLUMN     "moduleAccess" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "moduleAccess" TEXT[] DEFAULT ARRAY[]::TEXT[];
