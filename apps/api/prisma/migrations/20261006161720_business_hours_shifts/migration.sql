-- DropIndex
DROP INDEX "BusinessHours_restaurantId_dayOfWeek_key";

-- DropIndex
DROP INDEX "BusinessHours_restaurantId_idx";

-- AlterTable
ALTER TABLE "BusinessHours" DROP COLUMN "isOpen";

-- CreateIndex
CREATE INDEX "BusinessHours_restaurantId_dayOfWeek_idx" ON "BusinessHours"("restaurantId", "dayOfWeek");

