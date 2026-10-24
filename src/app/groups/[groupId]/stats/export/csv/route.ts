import { getGroup, getGroupExpenses } from '@/lib/api'
import { applyStatsFilters, StatsFilters } from '@/lib/stats-filters'
import { getSpendingByWeekday } from '@/lib/stats-insights'
import {
  filterExpensesByDateRange,
  getSpendingByCategory,
  getSpendingByParticipant,
  getSpendingOverTime,
  getSpendingSummary,
} from '@/lib/totals'
import { Parser } from '@json2csv/plainjs'
import { create as contentDisposition } from 'content-disposition'
import { NextResponse } from 'next/server'

/**
 * Exports the current stats view as CSV: one row per summary metric,
 * category, participant and month. The same pure aggregation functions as the
 * stats page are reused so the file always matches what the user sees.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params
  const url = new URL(req.url)
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined
  const filters: StatsFilters = {
    categoryId: url.searchParams.get('categoryId')
      ? Number(url.searchParams.get('categoryId'))
      : undefined,
    paidById: url.searchParams.get('paidById') ?? undefined,
    minAmount: url.searchParams.get('minAmount')
      ? Number(url.searchParams.get('minAmount'))
      : undefined,
    maxAmount: url.searchParams.get('maxAmount')
      ? Number(url.searchParams.get('maxAmount'))
      : undefined,
    hasReceipt:
      url.searchParams.get('hasReceipt') === 'true' ? true : undefined,
  }

  const [group, allExpenses] = await Promise.all([
    getGroup(groupId),
    getGroupExpenses(groupId),
  ])
  if (!group) {
    return NextResponse.json({ error: 'Invalid group ID' }, { status: 404 })
  }

  const expenses = filterExpensesByDateRange(
    applyStatsFilters(allExpenses, filters),
    from,
    to,
  )
  const summary = getSpendingSummary(expenses)
  const categories = getSpendingByCategory(expenses)
  const participants = getSpendingByParticipant(group.participants, expenses)
  const months = getSpendingOverTime(expenses)
  const weekdays = getSpendingByWeekday(expenses)

  const rows: Record<string, string | number>[] = [
    {
      section: 'summary',
      label: 'expenseCount',
      value: summary.expenseCount,
    },
    {
      section: 'summary',
      label: 'totalSpending',
      value: summary.totalSpending,
    },
    {
      section: 'summary',
      label: 'averageExpense',
      value: summary.averageExpense,
    },
    {
      section: 'summary',
      label: 'medianExpense',
      value: summary.medianExpense,
    },
    {
      section: 'summary',
      label: 'dailyAverage',
      value: summary.dailyAverage,
    },
    ...categories.map((category) => ({
      section: 'category',
      label: `${category.grouping} / ${category.name}`,
      value: category.total,
      sharePercent: category.sharePercent,
      count: category.expenseCount,
    })),
    ...participants.map((participant) => ({
      section: 'participant',
      label: participant.name,
      value: participant.share,
      paid: participant.paid,
      net: participant.net,
      count: participant.paidCount,
    })),
    ...months.map((month) => ({
      section: 'month',
      label: month.month,
      value: month.total,
    })),
    ...weekdays.map((day) => ({
      section: 'weekday',
      label: String(day.weekday),
      value: day.total,
      count: day.count,
    })),
  ]

  const csv = new Parser().parse(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': contentDisposition(
        `stats-${group.name.replace(/[^\w.-]+/g, '_')}.csv`,
      ),
    },
  })
}
