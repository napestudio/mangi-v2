-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_cashMovementId_fkey";

-- DropIndex
DROP INDEX "Expense_cashMovementId_key";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "cashMovementId";

