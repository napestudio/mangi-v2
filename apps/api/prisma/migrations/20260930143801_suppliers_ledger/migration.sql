-- CreateEnum
CREATE TYPE "SupplierLedgerEntryType" AS ENUM ('PURCHASE', 'PAYMENT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "balance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "IngredientSupplier" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "lastCost" DECIMAL(10,4),
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IngredientSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLedgerEntry" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "SupplierLedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "purchaseOrderId" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngredientSupplier_supplierId_idx" ON "IngredientSupplier"("supplierId");

-- CreateIndex
CREATE INDEX "IngredientSupplier_ingredientId_idx" ON "IngredientSupplier"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientSupplier_ingredientId_supplierId_key" ON "IngredientSupplier"("ingredientId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierId_idx" ON "SupplierLedgerEntry"("supplierId");

-- AddForeignKey
ALTER TABLE "IngredientSupplier" ADD CONSTRAINT "IngredientSupplier_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientSupplier" ADD CONSTRAINT "IngredientSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

