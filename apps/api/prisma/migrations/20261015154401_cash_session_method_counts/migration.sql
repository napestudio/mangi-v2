-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CASH_SESSION_CLOSED';

-- CreateTable
CREATE TABLE "CashSessionMethodCount" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "method" "PaymentMethodExtended" NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "countedAmount" DECIMAL(10,2) NOT NULL,
    "variance" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CashSessionMethodCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSessionMethodCount_sessionId_idx" ON "CashSessionMethodCount"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CashSessionMethodCount_sessionId_method_key" ON "CashSessionMethodCount"("sessionId", "method");

-- AddForeignKey
ALTER TABLE "CashSessionMethodCount" ADD CONSTRAINT "CashSessionMethodCount_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashRegisterSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

