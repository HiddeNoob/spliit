import { getSpendingByWeekday, getSpendingInsights } from './stats-insights'

function expense(
  date: string,
  amount: number,
  isReimbursement = false,
): { expenseDate: Date; amount: number; isReimbursement: boolean } {
  return {
    expenseDate: new Date(`${date}T00:00:00Z`),
    amount,
    isReimbursement,
  }
}

describe('getSpendingByWeekday', () => {
  it('returns seven buckets in Monday-first order', () => {
    const result = getSpendingByWeekday([])
    expect(result).toHaveLength(7)
    expect(result.map((day) => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('buckets by ISO weekday and ignores reimbursements', () => {
    // 2026-03-02 is a Monday, 2026-03-08 a Sunday.
    const result = getSpendingByWeekday([
      expense('2026-03-02', 1000),
      expense('2026-03-02', 500),
      expense('2026-03-08', 300),
      expense('2026-03-03', 999, true),
    ])
    expect(result[0]).toEqual({ weekday: 0, total: 1500, count: 2 })
    expect(result[6]).toEqual({ weekday: 6, total: 300, count: 1 })
    expect(result.reduce((sum, day) => sum + day.total, 0)).toBe(1800)
  })
})

describe('getSpendingInsights', () => {
  it('picks the biggest category, weekday and the average per participant', () => {
    const result = getSpendingInsights({
      categories: [
        { name: 'Groceries', total: 5000 },
        { name: 'Rent', total: 9000 },
      ],
      largestExpense: { title: 'Deposit', amount: 7000 },
      largestExpenseDate: '2026-03-05',
      participantCount: 4,
      totalSpending: 14000,
      weekdays: [
        { weekday: 0, total: 4000, count: 1 },
        { weekday: 1, total: 10000, count: 2 },
        { weekday: 2, total: 0, count: 0 },
        { weekday: 3, total: 0, count: 0 },
        { weekday: 4, total: 0, count: 0 },
        { weekday: 5, total: 0, count: 0 },
        { weekday: 6, total: 0, count: 0 },
      ],
    })

    expect(result.biggestCategory).toEqual({ name: 'Rent', total: 9000 })
    expect(result.biggestExpense).toEqual({
      title: 'Deposit',
      amount: 7000,
      date: '2026-03-05',
    })
    expect(result.averagePerParticipant).toBe(3500)
    expect(result.busiestWeekday?.weekday).toBe(1)
  })

  it('returns nulls rather than inventing numbers for an empty period', () => {
    const result = getSpendingInsights({
      categories: [],
      largestExpense: null,
      participantCount: 0,
      totalSpending: 0,
      weekdays: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        total: 0,
        count: 0,
      })),
    })
    expect(result.biggestCategory).toBeNull()
    expect(result.biggestExpense).toBeNull()
    expect(result.averagePerParticipant).toBeNull()
    expect(result.busiestWeekday).toBeNull()
  })
})
