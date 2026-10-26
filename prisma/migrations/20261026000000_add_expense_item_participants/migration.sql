-- Which participants each receipt line belongs to. An empty set means the line
-- is shared by everyone on the expense.
CREATE TABLE "ExpenseItemParticipant" (
    "itemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "ExpenseItemParticipant_pkey" PRIMARY KEY ("itemId","participantId")
);

CREATE INDEX "ExpenseItemParticipant_participantId_idx" ON "ExpenseItemParticipant"("participantId");

ALTER TABLE "ExpenseItemParticipant" ADD CONSTRAINT "ExpenseItemParticipant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ExpenseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseItemParticipant" ADD CONSTRAINT "ExpenseItemParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
