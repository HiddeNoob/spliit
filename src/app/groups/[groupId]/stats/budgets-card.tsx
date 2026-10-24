'use client'
import { CategoryIcon } from '@/app/groups/[groupId]/expenses/category-icon'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Currency } from '@/lib/currency'
import {
  amountAsDecimal,
  amountAsMinorUnits,
  cn,
  formatCurrency,
} from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { useCurrentGroup } from '../current-group-context'

type Props = {
  categories?: {
    id: number
    grouping: string
    name: string
  }[]
  currency?: Currency
}

export function BudgetsCard({ categories, currency }: Props) {
  const t = useTranslations('Stats.Budgets')
  const locale = useLocale()
  const { groupId } = useCurrentGroup()
  const utils = trpc.useUtils()

  const { data } = trpc.groups.budgets.list.useQuery({ groupId })
  const upsert = trpc.groups.budgets.upsert.useMutation({
    onSuccess: () => utils.groups.budgets.list.invalidate(),
  })
  const remove = trpc.groups.budgets.delete.useMutation({
    onSuccess: () => utils.groups.budgets.list.invalidate(),
  })

  const [editing, setEditing] = useState<{
    categoryId: number
    amount: string
  } | null>(null)

  if (!currency) return null

  const categoryLabel = (categoryId: number) => {
    if (categoryId === 0) return t('allCategories')
    const category = categories?.find((item) => item.id === categoryId)
    return category
      ? `${category.grouping} / ${category.name}`
      : `#${categoryId}`
  }

  const categoryForIcon = (categoryId: number) => {
    if (categoryId === 0) {
      return { id: 0, grouping: 'Uncategorized', name: 'General' }
    }
    const category = categories?.find((item) => item.id === categoryId)
    return category ?? { id: categoryId, grouping: '', name: '' }
  }

  const save = () => {
    if (!editing) return
    const amount = Number(editing.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) return
    upsert.mutate({
      groupId,
      categoryId: editing.categoryId,
      amount: amountAsMinorUnits(amount, currency),
    })
    setEditing(null)
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{t('title')}</span>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <Plus className="mr-1 h-4 w-4" />
                {t('add')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('add')}</DialogTitle>
                <DialogDescription>{t('dialogDescription')}</DialogDescription>
              </DialogHeader>
              <BudgetForm
                categories={categories ?? []}
                currency={currency}
                onSubmit={(categoryId, amount) => {
                  upsert.mutate({ groupId, categoryId, amount })
                }}
              />
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? null : data.progress.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {data.progress.map((budget) => {
              const percent = Math.round(budget.ratio * 100)
              return (
                <div key={budget.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <CategoryIcon
                        category={categoryForIcon(budget.categoryId)}
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">
                        {categoryLabel(budget.categoryId)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className={cn(
                          'tabular-nums text-xs',
                          budget.isOver
                            ? 'text-red-600 dark:text-red-400'
                            : budget.isNearLimit
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground',
                        )}
                      >
                        {formatCurrency(currency, budget.spent, locale)} /{' '}
                        {formatCurrency(currency, budget.limit, locale)} (
                        {percent}%)
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t('edit')}
                        onClick={() =>
                          setEditing({
                            categoryId: budget.categoryId,
                            amount: amountAsDecimal(
                              budget.limit,
                              currency,
                            ).toString(),
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t('delete')}
                        onClick={() =>
                          remove.mutate({ groupId, budgetId: budget.id })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        budget.isOver
                          ? 'bg-red-500'
                          : budget.isNearLimit
                            ? 'bg-amber-500'
                            : 'bg-primary',
                      )}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {budget.isOver
                      ? t('over', {
                          amount: formatCurrency(
                            currency,
                            Math.abs(budget.remaining),
                            locale,
                          ),
                        })
                      : t('remaining', {
                          amount: formatCurrency(
                            currency,
                            budget.remaining,
                            locale,
                          ),
                        })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {editing && (
          <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('edit')}</DialogTitle>
                <DialogDescription>{t('dialogDescription')}</DialogDescription>
              </DialogHeader>
              <BudgetForm
                categories={categories ?? []}
                currency={currency}
                initialCategoryId={editing.categoryId}
                initialAmount={editing.amount}
                onSubmit={(categoryId, amount) => {
                  upsert.mutate({ groupId, categoryId, amount })
                  setEditing(null)
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}

function BudgetForm({
  categories,
  currency,
  initialCategoryId = 0,
  initialAmount = '',
  onSubmit,
}: {
  categories: { id: number; grouping: string; name: string }[]
  currency: Currency
  initialCategoryId?: number
  initialAmount?: string
  onSubmit: (categoryId: number, amount: number) => void
}) {
  const t = useTranslations('Stats.Budgets')
  const [categoryId, setCategoryId] = useState(String(initialCategoryId))
  const [amount, setAmount] = useState(initialAmount)

  return (
    <div className="flex flex-col gap-3">
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger>
          <SelectValue placeholder={t('category')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">{t('allCategories')}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={String(category.id)}>
              {category.grouping} / {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-baseline gap-2">
        <span>{currency.symbol}</span>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <Button
        onClick={() =>
          onSubmit(
            Number(categoryId),
            amountAsMinorUnits(Number(amount.replace(',', '.')) || 0, currency),
          )
        }
      >
        {t('save')}
      </Button>
    </div>
  )
}
