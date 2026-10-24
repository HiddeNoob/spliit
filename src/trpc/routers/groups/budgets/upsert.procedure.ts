import { prisma } from '@/lib/prisma'
import { randomId } from '@/lib/random'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

/**
 * Creates or updates the monthly budget of a category. categoryId 0 is the
 * whole-group budget. Amounts arrive in minor units, like every other money
 * value in the app.
 */
export const upsertGroupBudgetProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      categoryId: z.number().int().min(0),
      amount: z.number().int().min(0).max(10_000_000_00),
    }),
  )
  .mutation(async ({ input: { groupId, categoryId, amount } }) => {
    const budget = await prisma.budget.upsert({
      where: { groupId_categoryId: { groupId, categoryId } },
      create: { id: randomId(), groupId, categoryId, amount },
      update: { amount },
    })
    return { budgetId: budget.id }
  })
