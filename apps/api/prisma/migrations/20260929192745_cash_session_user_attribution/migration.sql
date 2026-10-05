/*
  Warnings:

  - You are about to drop the column `createdBy` on the `CashMovement` table. All the data in the column will be lost.
  - You are about to drop the column `closedBy` on the `CashRegisterSession` table. All the data in the column will be lost.
  - You are about to drop the column `openedBy` on the `CashRegisterSession` table. All the data in the column will be lost.
  - You are about to drop the column `reopenedBy` on the `CashRegisterSession` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CashMovement" DROP COLUMN "createdBy",
ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "CashRegisterSession" DROP COLUMN "closedBy",
DROP COLUMN "openedBy",
DROP COLUMN "reopenedBy",
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "openedById" TEXT,
ADD COLUMN     "reopenedById" TEXT;

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
