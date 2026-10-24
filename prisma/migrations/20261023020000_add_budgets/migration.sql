CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Budget_groupId_categoryId_key" ON "Budget"("groupId", "categoryId");
CREATE INDEX "Budget_groupId_idx" ON "Budget"("groupId");

ALTER TABLE "Budget" ADD CONSTRAINT "Budget_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
