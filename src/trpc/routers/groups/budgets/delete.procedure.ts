import { prisma } from '@/lib/prisma'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

export const deleteGroupBudgetProcedure = baseProcedure
  .input(z.object({ groupId: z.string().min(1), budgetId: z.string().min(1) }))
  .mutation(async ({ input: { groupId, budgetId } }) => {
    await prisma.budget.deleteMany({ where: { id: budgetId, groupId } })
    return { budgetId }
  })
