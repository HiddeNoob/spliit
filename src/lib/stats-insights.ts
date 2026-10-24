import type { TotalComparison } from './stats-comparison'

export type WeekdaySpending = {
  /** 0 = Monday … 6 = Sunday (ISO weekday order). */
  weekday: number
  total: number
  count: number
}

const WEEKDAY_COUNT = 7

/**
 * Buckets spending by weekday, Monday first. Returns all seven days so the
 * heatmap keeps a stable shape even for weeks with no spending.
 */
export function getSpendingByWeekday<
  T extends { expenseDate: Date; amount: number; isReimbursement: boolean },
>(expenses: T[]): WeekdaySpending[] {
  const buckets: WeekdaySpending[] = Array.from(
    { length: WEEKDAY_COUNT },
    (_, weekday) => ({ weekday, total: 0, count: 0 }),
  )

  for (const expense of expenses) {
    if (expense.isReimbursement) continue
    // getUTCDay: 0 = Sunday. Shift so Monday is 0.
    const weekday = (expense.expenseDate.getUTCDay() + 6) % 7
    buckets[weekday].total += expense.amount
    buckets[weekday].count += 1
  }

  return buckets
}

export type SpendingInsights = {
  biggestCategory: { name: string; total: number } | null
  biggestExpense: {
    title: string
    amount: number
    date: string
  } | null
  averagePerParticipant: number | null
  busiestWeekday: WeekdaySpending | null
}

/**
 * Derives the "highlight" numbers shown at the top of the stats page. All
 * inputs are already aggregated by the overview procedure, so this adds no
 * extra query.
 */
export function getSpendingInsights(input: {
  categories: { name: string; total: number }[]
  largestExpense: { title: string; amount: number } | null
  largestExpenseDate?: string | null
  participantCount: number
  totalSpending: number
  weekdays: WeekdaySpending[]
}): SpendingInsights {
  const biggestCategory =
    input.categories.length === 0
      ? null
      : input.categories.reduce((best, category) =>
          category.total > best.total ? category : best,
        )

  const busiestWeekday = input.weekdays.some((day) => day.total > 0)
    ? input.weekdays.reduce((busiest, day) =>
        day.total > busiest.total ? day : busiest,
      )
    : null

  return {
    biggestCategory,
    biggestExpense: input.largestExpense
      ? {
          ...input.largestExpense,
          date: input.largestExpenseDate ?? '',
        }
      : null,
    averagePerParticipant:
      input.participantCount > 0
        ? Math.round(input.totalSpending / input.participantCount)
        : null,
    busiestWeekday,
  }
}

export type StatsExportComparison = {
  comparison?: TotalComparison
}
