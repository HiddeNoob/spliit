'use client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Currency } from '@/lib/currency'
import { SpendingInsights } from '@/lib/stats-insights'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'

type Props = {
  insights?: SpendingInsights
  currency?: Currency
}

const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export function SpendingInsightsCard({ insights, currency }: Props) {
  const t = useTranslations('Stats.Insights')
  const locale = useLocale()

  if (!insights || !currency) return null

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Insight
          label={t('biggestCategory')}
          value={insights.biggestCategory?.name ?? '—'}
          detail={
            insights.biggestCategory
              ? formatCurrency(currency, insights.biggestCategory.total, locale)
              : undefined
          }
        />
        <Insight
          label={t('biggestExpense')}
          value={insights.biggestExpense?.title ?? '—'}
          detail={
            insights.biggestExpense
              ? `${formatCurrency(currency, insights.biggestExpense.amount, locale)}${
                  insights.biggestExpense.date
                    ? ` · ${formatDateOnly(
                        new Date(`${insights.biggestExpense.date}T00:00:00Z`),
                        locale,
                        { dateStyle: 'medium' },
                      )}`
                    : ''
                }`
              : undefined
          }
        />
        <Insight
          label={t('averagePerParticipant')}
          value={
            insights.averagePerParticipant === null
              ? '—'
              : formatCurrency(currency, insights.averagePerParticipant, locale)
          }
        />
        <Insight
          label={t('busiestWeekday')}
          value={
            insights.busiestWeekday
              ? t(`weekday.${WEEKDAY_KEYS[insights.busiestWeekday.weekday]}`)
              : '—'
          }
          detail={
            insights.busiestWeekday
              ? formatCurrency(currency, insights.busiestWeekday.total, locale)
              : undefined
          }
        />
      </CardContent>
    </Card>
  )
}

function Insight({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="truncate text-base font-medium">{value}</div>
      {detail && (
        <div className="truncate text-xs text-muted-foreground tabular-nums">
          {detail}
        </div>
      )}
    </div>
  )
}
