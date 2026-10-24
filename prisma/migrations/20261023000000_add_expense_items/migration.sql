-- Optional merchant/store name for expenses created from a receipt.
ALTER TABLE "Expense" ADD COLUMN "merchant" TEXT;

-- Product lines that make up an expense. Balances keep using "Expense"."amount";
-- these rows are informational and power item-level statistics.
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpenseItem_expenseId_idx" ON "ExpenseItem"("expenseId");

ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
