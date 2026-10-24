'use client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Currency } from '@/lib/currency'
import { TotalComparison } from '@/lib/stats-comparison'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

type Props = {
  comparison?: {
    total: TotalComparison
    currentRange: { from: string; to: string }
    previousRange: { from: string; to: string }
  }
  currency?: Currency
}

export function PeriodComparison({ comparison, currency }: Props) {
  const t = useTranslations('Stats.Comparison')
  const locale = useLocale()

  if (!comparison || !currency) return null

  const { total, currentRange, previousRange } = comparison
  const formatDate = (date: string) =>
    formatDateOnly(new Date(`${date}T00:00:00Z`), locale, {
      dateStyle: 'medium',
    })
  const Icon =
    total.direction === 'up'
      ? ArrowUpRight
      : total.direction === 'down'
        ? ArrowDownRight
        : Minus

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('description', {
            from: formatDate(currentRange.from),
            to: formatDate(currentRange.to),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-2xl tabular-nums">
            {formatCurrency(currency, total.current, locale)}
          </span>
          {total.changePercent !== null ? (
            <span
              className={
                total.direction === 'up'
                  ? 'flex items-center gap-1 text-sm text-red-600 dark:text-red-400'
                  : total.direction === 'down'
                    ? 'flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400'
                    : 'flex items-center gap-1 text-sm text-muted-foreground'
              }
            >
              <Icon className="h-4 w-4" />
              {total.changePercent > 0 ? '+' : ''}
              {total.changePercent}%
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t('noPrevious')}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {t('previous', {
            amount: formatCurrency(currency, total.previous, locale),
            from: formatDate(previousRange.from),
            to: formatDate(previousRange.to),
          })}
        </div>
      </CardContent>
    </Card>
  )
}
