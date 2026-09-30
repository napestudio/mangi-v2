-- AlterTable
ALTER TABLE "StockMovement" RENAME COLUMN "createdBy" TO "createdById";

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
