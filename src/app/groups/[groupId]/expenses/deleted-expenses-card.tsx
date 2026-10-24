'use client'
import { CategoryIcon } from '@/app/groups/[groupId]/expenses/category-icon'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Currency } from '@/lib/currency'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { useCurrentGroup } from '../current-group-context'

/**
 * Recently deleted expenses with a one-click restore. Hidden entirely when
 * there is nothing to restore, so it does not add noise to the expenses page.
 */
export function DeletedExpensesCard({ currency }: { currency: Currency }) {
  const t = useTranslations('DeletedExpenses')
  const locale = useLocale()
  const { groupId } = useCurrentGroup()
  const [open, setOpen] = useState(false)
  const utils = trpc.useUtils()

  const { data } = trpc.groups.expenses.listDeleted.useQuery({
    groupId,
    limit: 20,
  })
  const restore = trpc.groups.expenses.restore.useMutation({
    onSuccess: () => {
      utils.groups.expenses.invalidate()
      utils.groups.stats.invalidate()
      utils.groups.expenses.listDeleted.invalidate()
    },
  })

  if (!data || data.expenses.length === 0) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            {t('title', { count: data.expenses.length })}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y border-t">
          {data.expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex items-center gap-3 px-4 py-2 text-sm"
            >
              <CategoryIcon
                category={
                  expense.category ?? {
                    id: 0,
                    grouping: 'Uncategorized',
                    name: 'General',
                  }
                }
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">{expense.title}</div>
                <div className="text-xs text-muted-foreground">
                  {expense.paidBy.name}
                  {expense.deletedAt
                    ? ` · ${formatDateOnly(expense.deletedAt, locale, {
                        dateStyle: 'medium',
                      })}`
                    : ''}
                </div>
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatCurrency(currency, expense.amount, locale)}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={restore.isPending}
                onClick={() =>
                  restore.mutate({ groupId, expenseId: expense.id })
                }
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {t('restore')}
              </Button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
