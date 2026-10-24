'use client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Currency } from '@/lib/currency'
import { amountAsMinorUnits } from '@/lib/utils'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

export type StatsFilterValues = {
  categoryId?: number
  paidById?: string
  minAmount?: number
  maxAmount?: number
  hasReceipt?: boolean
}

type Props = {
  categories: { id: number; grouping: string; name: string }[]
  participants: { id: string; name: string }[]
  currency?: Currency
  value: StatsFilterValues
  onChange: (value: StatsFilterValues) => void
}

/**
 * Client-side stats filters. The selected values are converted to minor units
 * before they are sent to the overview procedure, which keeps all amounts in
 * the same unit across the app.
 */
export function StatsFilters({
  categories,
  participants,
  currency,
  value,
  onChange,
}: Props) {
  const t = useTranslations('Stats.Filters')

  const hasFilters =
    value.categoryId !== undefined ||
    value.paidById !== undefined ||
    value.minAmount !== undefined ||
    value.maxAmount !== undefined ||
    value.hasReceipt !== undefined

  const toMinor = (input: string) => {
    const amount = Number(input.replace(',', '.'))
    if (!Number.isFinite(amount) || input.trim() === '' || !currency) {
      return undefined
    }
    return amountAsMinorUnits(amount, currency)
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{t('title')}</span>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({})}
            >
              <X className="mr-1 h-4 w-4" />
              {t('clear')}
            </Button>
          )}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Select
          value={
            value.categoryId === undefined ? 'all' : String(value.categoryId)
          }
          onValueChange={(next) =>
            onChange({
              ...value,
              categoryId: next === 'all' ? undefined : Number(next),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.grouping} / {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.paidById === undefined ? 'all' : value.paidById}
          onValueChange={(next) =>
            onChange({
              ...value,
              paidById: next === 'all' ? undefined : next,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('paidBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allPayers')}</SelectItem>
            {participants.map((participant) => (
              <SelectItem key={participant.id} value={participant.id}>
                {participant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <Input
            type="text"
            inputMode="decimal"
            placeholder={t('minAmount')}
            defaultValue=""
            onChange={(event) =>
              onChange({ ...value, minAmount: toMinor(event.target.value) })
            }
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder={t('maxAmount')}
            defaultValue=""
            onChange={(event) =>
              onChange({ ...value, maxAmount: toMinor(event.target.value) })
            }
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.hasReceipt === true}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                hasReceipt: checked === true ? true : undefined,
              })
            }
          />
          {t('onlyWithReceipt')}
        </label>
      </CardContent>
    </Card>
  )
}
