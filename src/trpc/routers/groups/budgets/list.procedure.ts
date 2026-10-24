import { getGroupExpenses } from '@/lib/api'
import { BudgetExpense, getBudgetProgress, getMonthRange } from '@/lib/budgets'
import { prisma } from '@/lib/prisma'
import { filterExpensesByDateRange } from '@/lib/totals'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

/**
 * Budgets plus their progress for the current calendar month. Kept as its own
 * query rather than piggybacking on the stats overview, because budgets are
 * independent of the stats date range.
 */
export const listGroupBudgetsProcedure = baseProcedure
  .input(z.object({ groupId: z.string().min(1) }))
  .query(async ({ input: { groupId } }) => {
    const [budgets, allExpenses] = await Promise.all([
      prisma.budget.findMany({
        where: { groupId },
        orderBy: { createdAt: 'asc' },
      }),
      getGroupExpenses(groupId),
    ])

    const range = getMonthRange()
    const monthExpenses = filterExpensesByDateRange(
      allExpenses,
      range.from,
      range.to,
    ) as BudgetExpense[]

    return {
      range,
      budgets: budgets.map((budget) => ({
        id: budget.id,
        categoryId: budget.categoryId,
        amount: budget.amount,
      })),
      progress: getBudgetProgress(budgets, monthExpenses),
    }
  })
