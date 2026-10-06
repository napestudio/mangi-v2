-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderNumber" INTEGER;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "lastOrderNumber" INTEGER NOT NULL DEFAULT 0;

-- Backfill: number existing orders sequentially per restaurant, oldest first.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "restaurantId" ORDER BY "createdAt") AS rn
  FROM "Order"
)
UPDATE "Order" o SET "orderNumber" = numbered.rn
FROM numbered
WHERE o.id = numbered.id;

-- Carry each restaurant's counter forward from its backfilled orders so new orders continue the sequence.
UPDATE "Restaurant" r SET "lastOrderNumber" = sub.max_number
FROM (SELECT "restaurantId", MAX("orderNumber") AS max_number FROM "Order" GROUP BY "restaurantId") sub
WHERE r.id = sub."restaurantId";

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_orderNumber_key" ON "Order"("restaurantId", "orderNumber");
