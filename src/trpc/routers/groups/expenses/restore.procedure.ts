import { restoreExpense } from '@/lib/api'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

export const restoreGroupExpenseProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      expenseId: z.string().min(1),
      participantId: z.string().optional(),
    }),
  )
  .mutation(async ({ input: { groupId, expenseId, participantId } }) => {
    const expense = await restoreExpense(groupId, expenseId, participantId)
    return { expenseId: expense.id }
  })
