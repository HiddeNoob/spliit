import {
  getActiveRecurringExpenses,
  getGroup,
  getGroupExpenses,
} from '@/lib/api'
import { getMonthlyCategorySpending } from '@/lib/monthly-spending'
import {
  compareTotals,
  getComparisonRanges,
  getPreviousRange,
} from '@/lib/stats-comparison'
import { applyStatsFilters, StatsFilters } from '@/lib/stats-filters'
import { getSpendingByWeekday, getSpendingInsights } from '@/lib/stats-insights'
import {
  CategorySpending,
  filterExpensesByDateRange,
  getRecurringSpending,
  getSpendingByCategory,
  getSpendingByParticipant,
  getSpendingOverTime,
  getSpendingSummary,
  getTotalActiveUserPaidFor,
  getTotalActiveUserShare,
  getTotalGroupSpending,
  withCategoryChanges,
} from '@/lib/totals'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

/**
 * Single data-loader for the whole stats page. Fetches the group's expenses
 * once and derives every stats section from them, so loading the page (and
 * changing the date range) costs one request instead of one per card.
 *
 * Recurring stats are range-independent (they reflect the currently active
 * subscriptions) and come from a separate query.
 */
export const getStatsOverviewProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      participantId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      categoryId: z.number().int().optional(),
      paidById: z.string().optional(),
      minAmount: z.number().int().optional(),
      maxAmount: z.number().int().optional(),
      hasReceipt: z.boolean().optional(),
    }),
  )
  .query(
    async ({
      input: {
        groupId,
        participantId,
        from,
        to,
        categoryId,
        paidById,
        minAmount,
        maxAmount,
        hasReceipt,
      },
    }) => {
      // getGroupExpenses and getActiveRecurringExpenses both materialize due
      // recurring frames; run them sequentially so the two passes don't race
      // each other (the second is a no-op once the first has materialized).
      const [group, allExpenses] = await Promise.all([
        getGroup(groupId),
        getGroupExpenses(groupId),
      ])
      const recurringExpenses = await getActiveRecurringExpenses(groupId)

      const filters: StatsFilters = {
        categoryId,
        paidById,
        minAmount,
        maxAmount,
        hasReceipt,
      }
      const filteredExpenses = applyStatsFilters(allExpenses, filters)
      const expenses = filterExpensesByDateRange(filteredExpenses, from, to)
      const participants = group?.participants ?? []

      // The comparison period uses the same filters so it compares like with
      // like. For an unbounded range the last 30 days are compared with the
      // previous 30.
      const comparisonRanges = getComparisonRanges(from, to)
      const currentPeriodExpenses = filterExpensesByDateRange(
        filteredExpenses,
        comparisonRanges.current.from,
        comparisonRanges.current.to,
      )
      const previousPeriodExpenses = filterExpensesByDateRange(
        filteredExpenses,
        comparisonRanges.previous.from,
        comparisonRanges.previous.to,
      )
      const currentTotal = getTotalGroupSpending(currentPeriodExpenses)
      const previousTotal = getTotalGroupSpending(previousPeriodExpenses)
      const comparisonCategories = withCategoryChanges(
        getSpendingByCategory(currentPeriodExpenses),
        getSpendingByCategory(previousPeriodExpenses),
      ) as CategorySpending[]

      const summary = getSpendingSummary(expenses)
      const weekdays = getSpendingByWeekday(expenses)
      // Category changes compare the selected range with the equally long
      // range before it. With no range selected there is no matching prior
      // window, so the 30-day comparison is reused.
      const selectedPreviousRange = getPreviousRange(from, to)
      const categoryPreviousExpenses = selectedPreviousRange
        ? filterExpensesByDateRange(
            filteredExpenses,
            selectedPreviousRange.from,
            selectedPreviousRange.to,
          )
        : previousPeriodExpenses
      const categories = withCategoryChanges(
        getSpendingByCategory(expenses),
        getSpendingByCategory(categoryPreviousExpenses),
      )
      const largestExpenseDate =
        summary.largestExpense === null
          ? null
          : (expenses
              .find(
                (expense) =>
                  !expense.isReimbursement &&
                  expense.amount === summary.largestExpense!.amount &&
                  expense.title === summary.largestExpense!.title,
              )
              ?.expenseDate.toISOString()
              .slice(0, 10) ?? null)

      return {
        totalGroupSpendings: getTotalGroupSpending(expenses),
        totalParticipantSpendings:
          participantId !== undefined
            ? getTotalActiveUserPaidFor(participantId, expenses)
            : undefined,
        totalParticipantShare:
          participantId !== undefined
            ? getTotalActiveUserShare(participantId, expenses)
            : undefined,
        summary,
        months: getSpendingOverTime(expenses),
        monthlyCategorySpending: getMonthlyCategorySpending(expenses, {
          grouping: 'category',
          from,
          to,
        }),
        participants: getSpendingByParticipant(participants, expenses),
        categories,
        comparison: {
          total: compareTotals(currentTotal, previousTotal),
          currentRange: comparisonRanges.current,
          previousRange: comparisonRanges.previous,
          categories: comparisonCategories,
        },
        weekdays,
        insights: getSpendingInsights({
          categories,
          largestExpense: summary.largestExpense,
          largestExpenseDate,
          participantCount: participants.length,
          totalSpending: summary.totalSpending,
          weekdays,
        }),
        recurring: getRecurringSpending(recurringExpenses),
      }
    },
  )
