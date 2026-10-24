import { getBudgetProgress, getMonthRange } from './budgets'

const budgets = [
  { id: 'all', categoryId: 0, amount: 100000 },
  { id: 'food', categoryId: 4, amount: 30000 },
  { id: 'rent', categoryId: 9, amount: 50000 },
]

function expense(
  amount: number,
  categoryId: number | null,
  isReimbursement = false,
) {
  return {
    amount,
    category:
      categoryId === null ? null : { id: categoryId, grouping: 'x', name: 'y' },
    expenseDate: new Date('2026-03-10T00:00:00Z'),
    isReimbursement,
  }
}

describe('getBudgetProgress', () => {
  it('computes whole-group and per-category progress', () => {
    const result = getBudgetProgress(budgets, [
      expense(20000, 4),
      expense(15000, 9),
      expense(5000, null),
      expense(99999, 4, true),
    ])

    const all = result.find((budget) => budget.id === 'all')!
    expect(all.spent).toBe(40000)
    expect(all.remaining).toBe(60000)
    expect(all.ratio).toBeCloseTo(0.4)

    const food = result.find((budget) => budget.id === 'food')!
    expect(food.spent).toBe(20000)
    expect(food.remaining).toBe(10000)
    expect(food.isNearLimit).toBe(false)
  })

  it('flags budgets over the limit', () => {
    const result = getBudgetProgress(
      [{ id: 'food', categoryId: 4, amount: 10000 }],
      [expense(12000, 4)],
    )[0]
    expect(result.isOver).toBe(true)
    expect(result.remaining).toBe(-2000)
  })

  it('flags budgets at or above 80%', () => {
    const result = getBudgetProgress(
      [{ id: 'food', categoryId: 4, amount: 10000 }],
      [expense(8000, 4)],
    )[0]
    expect(result.isNearLimit).toBe(true)
    expect(result.isOver).toBe(false)
  })

  it('sorts by usage ratio, most used first', () => {
    const result = getBudgetProgress(
      [
        { id: 'a', categoryId: 1, amount: 10000 },
        { id: 'b', categoryId: 2, amount: 10000 },
      ],
      [expense(9000, 1), expense(1000, 2)],
    )
    expect(result.map((budget) => budget.id)).toEqual(['a', 'b'])
  })

  it('treats a zero limit without dividing by zero', () => {
    const result = getBudgetProgress(
      [{ id: 'zero', categoryId: 0, amount: 0 }],
      [expense(1000, null)],
    )[0]
    expect(result.ratio).toBe(0)
    expect(result.isOver).toBe(true)
  })
})

describe('getMonthRange', () => {
  it('returns the full current month', () => {
    expect(getMonthRange(new Date(2026, 1, 15))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })

  it('handles leap years', () => {
    expect(getMonthRange(new Date(2028, 1, 15)).to).toBe('2028-02-29')
  })
})
