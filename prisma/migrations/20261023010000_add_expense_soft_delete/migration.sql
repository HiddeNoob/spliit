-- Soft delete: a deleted expense stays in the database so it can be restored.
ALTER TABLE "Expense" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Expense_groupId_deletedAt_idx" ON "Expense"("groupId", "deletedAt");

-- Activity enum value for restoring an expense.
ALTER TYPE "ActivityType" ADD VALUE 'RESTORE_EXPENSE';
