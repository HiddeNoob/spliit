ALTER TABLE "RecurringExpenseLink" ADD COLUMN "endsOn" DATE;
ALTER TABLE "RecurringExpenseLink" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;
ALTER TYPE "RecurrenceRule" ADD VALUE 'YEARLY';
