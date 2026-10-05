-- CreateEnum
CREATE TYPE "DeliveryZoneType" AS ENUM ('RADIUS', 'POLYGON');

-- AlterTable
ALTER TABLE "DeliveryConfig" DROP COLUMN "coverageRadius";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryLatitude" DOUBLE PRECISION,
ADD COLUMN     "deliveryLongitude" DOUBLE PRECISION,
ADD COLUMN     "deliveryZoneId" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "deliveryConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeliveryZoneType" NOT NULL DEFAULT 'RADIUS',
    "minRadiusMeters" DOUBLE PRECISION,
    "maxRadiusMeters" DOUBLE PRECISION,
    "polygon" JSONB,
    "fee" DECIMAL(10,2) NOT NULL,
    "estimatedMinutes" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryZone_deliveryConfigId_idx" ON "DeliveryZone"("deliveryConfigId");

-- CreateIndex
CREATE INDEX "Order_deliveryZoneId_idx" ON "Order"("deliveryZoneId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_deliveryConfigId_fkey" FOREIGN KEY ("deliveryConfigId") REFERENCES "DeliveryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

