/**
 * Shared filtering for the stats page and its CSV export. Kept away from the
 * tRPC procedure so the route handler does not have to import the router just
 * to reuse the filter shape.
 */
export type StatsFilters = {
  categoryId?: number
  paidById?: string
  minAmount?: number
  maxAmount?: number
  hasReceipt?: boolean
}

type FilterableExpense = {
  amount: number
  category: { id: number } | null
  paidBy: { id: string }
  _count: { documents: number }
}

export function applyStatsFilters<T extends FilterableExpense>(
  expenses: T[],
  filters: StatsFilters,
): T[] {
  return expenses.filter((expense) => {
    if (
      filters.categoryId !== undefined &&
      (expense.category?.id ?? 0) !== filters.categoryId
    ) {
      return false
    }
    if (
      filters.paidById !== undefined &&
      expense.paidBy.id !== filters.paidById
    ) {
      return false
    }
    if (filters.minAmount !== undefined && expense.amount < filters.minAmount) {
      return false
    }
    if (filters.maxAmount !== undefined && expense.amount > filters.maxAmount) {
      return false
    }
    if (
      filters.hasReceipt !== undefined &&
      expense._count.documents > 0 !== filters.hasReceipt
    ) {
      return false
    }
    return true
  })
}
