-- Clear pre-existing test reservations (no production data yet) so businessDate can be added as NOT NULL.
DELETE FROM "ReservationTable";
DELETE FROM "Reservation";

-- AlterTable
ALTER TABLE "TimeSlot" ADD COLUMN     "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "businessDate" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "Reservation_businessDate_idx" ON "Reservation"("businessDate");
