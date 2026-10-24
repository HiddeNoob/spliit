import { getDeletedExpenses } from '@/lib/api'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

/**
 * Lists the group's recently deleted (soft-deleted) expenses so they can be
 * restored from the expenses page.
 */
export const listDeletedGroupExpensesProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  )
  .query(async ({ input: { groupId, limit } }) => {
    return { expenses: await getDeletedExpenses(groupId, limit) }
  })
