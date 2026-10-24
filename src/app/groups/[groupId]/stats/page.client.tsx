'use client'
import { useCurrentGroup } from '@/app/groups/[groupId]/current-group-context'
import { CategoryBreakdown } from '@/app/groups/[groupId]/stats/category-breakdown'
import { SpendingInsightsCard } from '@/app/groups/[groupId]/stats/insights-card'
import { MonthlySpending } from '@/app/groups/[groupId]/stats/monthly-spending'
import { ParticipantSpendingStats } from '@/app/groups/[groupId]/stats/participant-spending'
import { PeriodComparison } from '@/app/groups/[groupId]/stats/period-comparison'
import { RecurringSpendingStats } from '@/app/groups/[groupId]/stats/recurring-spending'
import { SpendingOverTime } from '@/app/groups/[groupId]/stats/spending-over-time'
import {
  StatsFilters,
  StatsFilterValues,
} from '@/app/groups/[groupId]/stats/stats-filters'
import {
  resolveStatsRange,
  StatsPeriod,
  StatsRange,
} from '@/app/groups/[groupId]/stats/stats-range'
import { StatsRangeSelector } from '@/app/groups/[groupId]/stats/stats-range-selector'
import { SummaryStats } from '@/app/groups/[groupId]/stats/summary-stats'
import { Totals } from '@/app/groups/[groupId]/stats/totals'
import { WeekdayHeatmap } from '@/app/groups/[groupId]/stats/weekday-heatmap'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useActiveUser } from '@/lib/hooks'
import { getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export function TotalsPageClient() {
  const t = useTranslations('Stats')
  const { groupId, group } = useCurrentGroup()
  const activeUser = useActiveUser(groupId)
  const participantId =
    activeUser && activeUser !== 'None' ? activeUser : undefined

  const [period, setPeriod] = useState<StatsPeriod>('all')
  const [customRange, setCustomRange] = useState<StatsRange>({})
  const [filters, setFilters] = useState<StatsFilterValues>({})
  const range = resolveStatsRange(period, customRange)

  const { data } = trpc.groups.stats.overview.useQuery({
    groupId,
    participantId,
    from: range.from,
    to: range.to,
    categoryId: filters.categoryId,
    paidById: filters.paidById,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    hasReceipt: filters.hasReceipt,
  })

  const { data: categoriesData } = trpc.categories.list.useQuery()
  const currency = group ? getCurrencyFromGroup(group) : undefined

  const exportParams = new URLSearchParams()
  if (range.from) exportParams.set('from', range.from)
  if (range.to) exportParams.set('to', range.to)
  if (filters.categoryId !== undefined)
    exportParams.set('categoryId', String(filters.categoryId))
  if (filters.paidById) exportParams.set('paidById', filters.paidById)
  if (filters.minAmount !== undefined)
    exportParams.set('minAmount', String(filters.minAmount))
  if (filters.maxAmount !== undefined)
    exportParams.set('maxAmount', String(filters.maxAmount))
  if (filters.hasReceipt) exportParams.set('hasReceipt', 'true')
  const exportHref = `/groups/${groupId}/stats/export/csv?${exportParams.toString()}`

  return (
    <>
      <StatsRangeSelector
        period={period}
        customRange={customRange}
        onPeriodChange={setPeriod}
        onCustomRangeChange={setCustomRange}
      />
      <StatsFilters
        categories={categoriesData?.categories ?? []}
        participants={group?.participants ?? []}
        currency={currency}
        value={filters}
        onChange={setFilters}
      />
      <SummaryStats summary={data?.summary} currency={currency} />
      <PeriodComparison comparison={data?.comparison} currency={currency} />
      <SpendingInsightsCard insights={data?.insights} currency={currency} />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t('Totals.title')}</CardTitle>
          <CardDescription>{t('Totals.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
          <Totals
            totalGroupSpendings={data?.totalGroupSpendings}
            totalParticipantSpendings={data?.totalParticipantSpendings}
            totalParticipantShare={data?.totalParticipantShare}
            currency={currency}
          />
        </CardContent>
      </Card>
      <SpendingOverTime
        groupId={groupId}
        months={data?.months}
        currency={currency}
        from={range.from}
        to={range.to}
      />
      <MonthlySpending
        monthlyCategorySpending={data?.monthlyCategorySpending}
        currency={currency}
      />
      <WeekdayHeatmap weekdays={data?.weekdays} currency={currency} />
      <ParticipantSpendingStats
        participants={data?.participants}
        currency={currency}
      />
      <CategoryBreakdown
        groupId={groupId}
        categories={data?.categories}
        currency={currency}
        from={range.from}
        to={range.to}
      />
      <RecurringSpendingStats recurring={data?.recurring} currency={currency} />
      <div className="mb-4 flex justify-end">
        <Button asChild variant="outline" size="sm">
          <a href={exportHref} download>
            <Download className="mr-2 h-4 w-4" />
            {t('exportCsv')}
          </a>
        </Button>
      </div>
    </>
  )
}
