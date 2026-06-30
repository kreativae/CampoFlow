-- CreateTable
CREATE TABLE "FarmInvite" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmInvite_farmId_idx" ON "FarmInvite"("farmId");

-- AddForeignKey
ALTER TABLE "FarmInvite" ADD CONSTRAINT "FarmInvite_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
