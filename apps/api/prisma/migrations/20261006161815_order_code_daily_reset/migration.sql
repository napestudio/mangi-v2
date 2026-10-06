-- DropIndex
DROP INDEX "Order_restaurantId_orderNumber_key";

-- AlterTable
ALTER TABLE "Restaurant" DROP COLUMN "lastOrderNumber";

-- CreateTable
CREATE TABLE "OrderNumberCounter" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "day" DATE NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderNumberCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderNumberCounter_restaurantId_idx" ON "OrderNumberCounter"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderNumberCounter_restaurantId_orderType_day_key" ON "OrderNumberCounter"("restaurantId", "orderType", "day");

-- AddForeignKey
ALTER TABLE "OrderNumberCounter" ADD CONSTRAINT "OrderNumberCounter_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

