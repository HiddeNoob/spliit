import { applyStatsFilters } from './stats-filters'

function expense(overrides: {
  id?: string
  amount?: number
  categoryId?: number | null
  paidById?: string
  documents?: number
}) {
  return {
    id: overrides.id ?? 'e1',
    amount: overrides.amount ?? 1000,
    category:
      overrides.categoryId === undefined || overrides.categoryId === null
        ? null
        : { id: overrides.categoryId },
    paidBy: { id: overrides.paidById ?? 'alice' },
    _count: { documents: overrides.documents ?? 0 },
  }
}

describe('applyStatsFilters', () => {
  it('returns everything with no filters', () => {
    const expenses = [expense({}), expense({ id: 'e2' })]
    expect(applyStatsFilters(expenses, {})).toHaveLength(2)
  })

  it('filters by category, treating no category as 0', () => {
    const expenses = [
      expense({ id: 'a', categoryId: 4 }),
      expense({ id: 'b', categoryId: null }),
    ]
    expect(
      applyStatsFilters(expenses, { categoryId: 4 }).map((e) => e.id),
    ).toEqual(['a'])
    expect(
      applyStatsFilters(expenses, { categoryId: 0 }).map((e) => e.id),
    ).toEqual(['b'])
  })

  it('filters by payer', () => {
    const expenses = [
      expense({ id: 'a', paidById: 'alice' }),
      expense({ id: 'b', paidById: 'bob' }),
    ]
    expect(
      applyStatsFilters(expenses, { paidById: 'bob' }).map((e) => e.id),
    ).toEqual(['b'])
  })

  it('filters by amount bounds inclusively', () => {
    const expenses = [
      expense({ id: 'a', amount: 500 }),
      expense({ id: 'b', amount: 1000 }),
      expense({ id: 'c', amount: 2000 }),
    ]
    expect(
      applyStatsFilters(expenses, { minAmount: 500, maxAmount: 1000 }).map(
        (e) => e.id,
      ),
    ).toEqual(['a', 'b'])
  })

  it('filters by receipt presence', () => {
    const expenses = [
      expense({ id: 'a', documents: 2 }),
      expense({ id: 'b', documents: 0 }),
    ]
    expect(
      applyStatsFilters(expenses, { hasReceipt: true }).map((e) => e.id),
    ).toEqual(['a'])
    expect(
      applyStatsFilters(expenses, { hasReceipt: false }).map((e) => e.id),
    ).toEqual(['b'])
  })
})
