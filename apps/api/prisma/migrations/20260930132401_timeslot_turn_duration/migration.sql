-- AlterTable
ALTER TABLE "TimeSlot" ADD COLUMN     "turnDurationMinutes" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "bufferMinutes" INTEGER NOT NULL DEFAULT 0;
