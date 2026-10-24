import { expenseFormSchema } from './schemas'

function byAmountExpense(amount: string, shares: string[]) {
  return {
    expenseDate: new Date('2026-09-01'),
    title: 'Dinner',
    amount,
    paidBy: 'a',
    splitMode: 'BY_AMOUNT',
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    paidFor: shares.map((shares, i) => ({ participant: `p${i}`, shares })),
  }
}

function issueMessages(input: unknown): string[] {
  const result = expenseFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('expenseFormSchema, split by amount', () => {
  it('accepts amounts that add up to the expense amount', () => {
    expect(
      issueMessages(
        byAmountExpense('524.34', [
          '110.11',
          '209.74',
          '104.87',
          '89.14',
          '10.48',
        ]),
      ),
    ).toEqual([])
  })

  it('rejects amounts one cent off', () => {
    expect(
      issueMessages(
        byAmountExpense('524.34', [
          '110.11',
          '209.74',
          '104.87',
          '89.14',
          '10.49',
        ]),
      ),
    ).toEqual(['amountSum'])
  })

  it('sums amounts typed with a decimal comma', () => {
    expect(
      issueMessages(byAmountExpense('100', ['50', '30', '20,00'])),
    ).toEqual([])
  })

  it('reports an emptied amount instead of throwing on it', () => {
    expect(issueMessages(byAmountExpense('100', ['60', '']))).toEqual([
      'noZeroShares',
      'amountSum',
    ])
  })
})

describe('expenseFormSchema documents', () => {
  const base = {
    title: 'Receipt',
    expenseDate: new Date('2026-10-24T12:00:00.000Z'),
    amount: 10,
    category: 0,
    paidBy: 'p1',
    paidFor: [{ participant: 'p1', shares: 1 }],
    splitMode: 'EVENLY' as const,
    saveDefaultSplittingOptions: false,
    isReimbursement: false,
    notes: '',
    recurrenceRule: 'NONE' as const,
  }

  it('accepts a locally stored image', () => {
    const result = expenseFormSchema.safeParse({
      ...base,
      documents: [
        {
          id: 'doc',
          url: '/api/uploads/abcdefghijklmnopqrst.jpg',
          width: 600,
          height: 800,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('still accepts an absolute URL', () => {
    const result = expenseFormSchema.safeParse({
      ...base,
      documents: [
        {
          id: 'doc',
          url: 'https://bucket.example.com/receipt.jpg',
          width: 600,
          height: 800,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a relative path outside the upload route', () => {
    const result = expenseFormSchema.safeParse({
      ...base,
      documents: [{ id: 'doc', url: '/etc/passwd', width: 600, height: 800 }],
    })
    expect(result.success).toBe(false)
  })
})
