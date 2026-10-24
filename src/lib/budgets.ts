/**
 * Budget progress helpers.
 *
 * Budgets are monthly limits stored in minor units. Progress is computed from
 * the expenses of the current calendar month only, which keeps the card
 * meaningful regardless of the range selected elsewhere on the stats page.
 */

export type BudgetRow = {
  id: string
  categoryId: number
  amount: number
}

export type BudgetExpense = {
  amount: number
  category: { id: number; grouping: string; name: string } | null
  expenseDate: Date
  isReimbursement: boolean
}

export type BudgetProgress = {
  id: string
  categoryId: number
  limit: number
  spent: number
  remaining: number
  /** spent / limit, 0..∞. 0 when the limit is 0. */
  ratio: number
  isOver: boolean
  /** True once 80% of the limit is used but it is not exceeded yet. */
  isNearLimit: boolean
}

/** First and last day of the month containing `date`, as `YYYY-MM-DD`. */
export function getMonthRange(date = new Date()): { from: string; to: string } {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

/**
 * Computes progress for every budget. A budget with categoryId 0 tracks the
 * whole group; any other id tracks that category (uncategorized expenses count
 * as category 0, matching the stats page).
 */
export function getBudgetProgress(
  budgets: BudgetRow[],
  expenses: BudgetExpense[],
): BudgetProgress[] {
  const relevant = expenses.filter((expense) => !expense.isReimbursement)

  return budgets
    .map((budget) => {
      const spent = relevant
        .filter((expense) =>
          budget.categoryId === 0
            ? true
            : (expense.category?.id ?? 0) === budget.categoryId,
        )
        .reduce((sum, expense) => sum + expense.amount, 0)

      return {
        id: budget.id,
        categoryId: budget.categoryId,
        limit: budget.amount,
        spent,
        remaining: budget.amount - spent,
        ratio: budget.amount === 0 ? 0 : spent / budget.amount,
        isOver: spent > budget.amount,
        isNearLimit: spent <= budget.amount && spent >= budget.amount * 0.8,
      }
    })
    .sort((a, b) => b.ratio - a.ratio)
}
