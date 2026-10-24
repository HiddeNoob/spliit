'use client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Currency } from '@/lib/currency'
import { WeekdaySpending } from '@/lib/stats-insights'
import { amountAsDecimal, cn, formatCurrency } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'

type Props = {
  weekdays?: WeekdaySpending[]
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

// Buckets instead of an inline opacity, so the foreground stays readable.
const INTENSITY_CLASSES = [
  'bg-muted text-muted-foreground',
  'bg-primary/15',
  'bg-primary/30',
  'bg-primary/50',
  'bg-primary/70',
  'bg-primary/90 text-primary-foreground',
]

export function WeekdayHeatmap({ weekdays, currency }: Props) {
  const t = useTranslations('Stats.Weekday')
  const locale = useLocale()

  if (!weekdays || !currency) return null
  const max = Math.max(...weekdays.map((day) => day.total), 0)
  if (max === 0) return null

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {weekdays.map((day) => {
            const ratio = day.total / max
            const bucket =
              day.total === 0
                ? 0
                : Math.min(
                    INTENSITY_CLASSES.length - 1,
                    Math.max(
                      1,
                      Math.ceil(ratio * (INTENSITY_CLASSES.length - 1)),
                    ),
                  )
            return (
              <div
                key={day.weekday}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    'flex h-12 w-full items-center justify-center rounded-md border text-[10px] tabular-nums',
                    INTENSITY_CLASSES[bucket],
                  )}
                  title={`${formatCurrency(currency, day.total, locale)} · ${t('expenses', { count: day.count })}`}
                >
                  {day.total === 0
                    ? '—'
                    : new Intl.NumberFormat(locale, {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(amountAsDecimal(day.total, currency))}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {t(`days.${WEEKDAY_KEYS[day.weekday]}`)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
