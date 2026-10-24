import {
  ActivityType,
  RecurrenceRule,
  SplitMode,
} from '@/generated/prisma/client'
import { CsvExpenseRow, GroupBackup } from '@/lib/import-backup'
import { prisma } from '@/lib/prisma'
import { randomId } from '@/lib/random'

/**
 * Serializes a group into the versioned backup format. Only metadata about
 * documents is included: the image files themselves live in S3 and are not
 * copied by a database backup.
 */
export async function getGroupBackup(
  groupId: string,
): Promise<GroupBackup | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      participants: { orderBy: { name: 'asc' } },
      expenses: {
        orderBy: { expenseDate: 'asc' },
        include: {
          paidFor: true,
          documents: true,
        },
      },
    },
  })
  if (!group) return null

  const refs = new Map(
    group.participants.map((participant) => [participant.id, participant.id]),
  )

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    group: {
      name: group.name,
      information: group.information,
      currency: group.currency,
      currencyCode: group.currencyCode,
      showFutureExpenses: group.showFutureExpenses,
      participants: group.participants.map((participant) => ({
        name: participant.name,
        ref: refs.get(participant.id)!,
      })),
      expenses: group.expenses.map((expense) => ({
        title: expense.title,
        amount: expense.amount,
        originalAmount: expense.originalAmount,
        originalCurrency: expense.originalCurrency,
        conversionRate: expense.conversionRate?.toNumber() ?? null,
        expenseDate: expense.expenseDate.toISOString().slice(0, 10),
        categoryId: expense.categoryId,
        paidByRef: refs.get(expense.paidById)!,
        paidFor: expense.paidFor.map((paidFor) => ({
          participantRef: refs.get(paidFor.participantId)!,
          shares: Number(paidFor.shares),
        })),
        splitMode: expense.splitMode,
        isReimbursement: expense.isReimbursement,
        notes: expense.notes,
        documents: expense.documents.map((document) => ({
          url: document.url,
          width: document.width,
          height: document.height,
        })),
      })),
    },
  }
}

/**
 * Restores a backup into a brand new group. It never touches an existing
 * group, so importing the same file twice produces two groups rather than
 * merging or overwriting data. Participant references are remapped to fresh
 * ids; the whole import runs in one transaction.
 */
export async function restoreGroupBackup(backup: GroupBackup) {
  const participantIds = new Map(
    backup.group.participants.map((participant) => [
      participant.ref,
      randomId(),
    ]),
  )

  return prisma.$transaction(async (transaction) => {
    const groupId = randomId()
    await transaction.group.create({
      data: {
        id: groupId,
        name: backup.group.name,
        information: backup.group.information ?? null,
        currency: backup.group.currency,
        currencyCode: backup.group.currencyCode ?? null,
        showFutureExpenses: backup.group.showFutureExpenses,
        participants: {
          createMany: {
            data: backup.group.participants.map((participant) => ({
              id: participantIds.get(participant.ref)!,
              name: participant.name,
            })),
          },
        },
      },
    })

    for (const expense of backup.group.expenses) {
      await transaction.expense.create({
        data: {
          id: randomId(),
          groupId,
          title: expense.title,
          amount: expense.amount,
          originalAmount: expense.originalAmount ?? null,
          originalCurrency: expense.originalCurrency ?? null,
          conversionRate: expense.conversionRate ?? null,
          expenseDate: new Date(`${expense.expenseDate}T00:00:00.000Z`),
          categoryId: expense.categoryId,
          paidById: participantIds.get(expense.paidByRef)!,
          splitMode: expense.splitMode as SplitMode,
          isReimbursement: expense.isReimbursement,
          recurrenceRule: RecurrenceRule.NONE,
          notes: expense.notes ?? null,
          paidFor: {
            createMany: {
              data: expense.paidFor.map((paidFor) => ({
                participantId: participantIds.get(paidFor.participantRef)!,
                shares: paidFor.shares,
              })),
            },
          },
          documents: {
            createMany: {
              data: expense.documents.map((document) => ({
                id: randomId(),
                url: document.url,
                width: document.width,
                height: document.height,
              })),
            },
          },
        },
      })
    }

    await transaction.activity.create({
      data: {
        id: randomId(),
        groupId,
        activityType: ActivityType.UPDATE_GROUP,
        data: 'Backup restored',
      },
    })

    return { groupId }
  })
}

export type CsvImportResult = {
  created: number
  skipped: { line: number; message: string }[]
}

/**
 * Imports parsed CSV rows into an existing group. Participant names are
 * matched case-insensitively; unknown names are reported instead of silently
 * creating participants, so a typo cannot pollute the group.
 */
export async function importCsvExpenses(
  groupId: string,
  rows: CsvExpenseRow[],
): Promise<CsvImportResult> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { participants: true },
  })
  if (!group) throw new Error(`Invalid group ID: ${groupId}`)

  const byName = new Map(
    group.participants.map((participant) => [
      participant.name.trim().toLowerCase(),
      participant.id,
    ]),
  )

  const skipped: CsvImportResult['skipped'] = []
  let created = 0

  await prisma.$transaction(async (transaction) => {
    for (const [index, row] of rows.entries()) {
      const paidById = byName.get(row.paidBy.trim().toLowerCase())
      const paidForIds = row.paidFor.map((name) =>
        byName.get(name.trim().toLowerCase()),
      )
      if (!paidById || paidForIds.some((id) => id === undefined)) {
        skipped.push({ line: index + 2, message: 'unknownParticipant' })
        continue
      }

      await transaction.expense.create({
        data: {
          id: randomId(),
          groupId,
          title: row.title,
          amount: row.amount,
          expenseDate: new Date(`${row.date}T00:00:00.000Z`),
          categoryId: 0,
          paidById,
          splitMode: SplitMode.BY_SHARES,
          notes: row.notes ?? null,
          paidFor: {
            createMany: {
              data: paidForIds.map((participantId, i) => ({
                participantId: participantId!,
                shares: row.shares[i] ?? 1,
              })),
            },
          },
        },
      })
      created += 1
    }

    await transaction.activity.create({
      data: {
        id: randomId(),
        groupId,
        activityType: ActivityType.UPDATE_GROUP,
        data: `Imported ${created} expenses from CSV`,
      },
    })
  })

  return { created, skipped }
}
