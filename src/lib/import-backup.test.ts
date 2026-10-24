import { parseCsv, parseExpenseCsv, parseGroupBackup } from './import-backup'

function backup(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    exportedAt: '2026-03-01T00:00:00.000Z',
    group: {
      name: 'Home',
      currency: '€',
      currencyCode: 'EUR',
      participants: [
        { name: 'Alice', ref: 'a' },
        { name: 'Bob', ref: 'b' },
      ],
      expenses: [
        {
          title: 'Rent',
          amount: 90000,
          expenseDate: '2026-03-01',
          paidByRef: 'a',
          paidFor: [
            { participantRef: 'a', shares: 1 },
            { participantRef: 'b', shares: 1 },
          ],
        },
      ],
      ...(overrides.group as object),
    },
  }
}

describe('parseGroupBackup', () => {
  it('accepts a valid backup and fills defaults', () => {
    const result = parseGroupBackup(JSON.stringify(backup()))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.backup.group.showFutureExpenses).toBe(true)
      expect(result.backup.group.expenses[0].splitMode).toBe('EVENLY')
      expect(result.backup.group.expenses[0].documents).toEqual([])
    }
  })

  it('rejects malformed JSON and schema violations', () => {
    expect(parseGroupBackup('{')).toEqual({ ok: false, error: 'invalidJson' })
    expect(
      parseGroupBackup(JSON.stringify({ schemaVersion: 99, group: {} })),
    ).toEqual({ ok: false, error: 'invalidBackup' })
  })

  it('rejects unknown participant references', () => {
    const invalid = backup({
      group: {
        name: 'Home',
        currency: '€',
        participants: [{ name: 'Alice', ref: 'a' }],
        expenses: [
          {
            title: 'Rent',
            amount: 1000,
            expenseDate: '2026-03-01',
            paidByRef: 'missing',
            paidFor: [{ participantRef: 'a', shares: 1 }],
          },
        ],
      },
    })
    expect(parseGroupBackup(JSON.stringify(invalid))).toEqual({
      ok: false,
      error: 'unknownPaidBy',
    })
  })

  it('rejects categories that do not exist in this instance', () => {
    const withCategory = JSON.parse(JSON.stringify(backup())) as ReturnType<
      typeof backup
    >
    ;(withCategory.group.expenses[0] as Record<string, unknown>).categoryId = 5
    const result = parseGroupBackup(JSON.stringify(withCategory), {
      categoryIds: new Set([0]),
    })
    expect(result).toEqual({ ok: false, error: 'unknownCategory' })
  })

  it('rejects oversized files', () => {
    expect(parseGroupBackup('x'.repeat(10 * 1024 * 1024 + 1))).toEqual({
      ok: false,
      error: 'fileTooLarge',
    })
  })
})

describe('parseCsv', () => {
  it('parses quoted fields, escaped quotes and CRLF', () => {
    const rows = parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ])
  })

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('a,"line1\nline2"\n')).toEqual([['a', 'line1\nline2']])
  })

  it('skips blank lines', () => {
    expect(parseCsv('a\n\n\nb\n')).toEqual([['a'], ['b']])
  })
})

describe('parseExpenseCsv', () => {
  it('maps a generic CSV', () => {
    const result = parseExpenseCsv(
      'date,title,amount,paid_by,paid_for,shares\n2026-03-01,Groceries,"12,50",Alice,"Alice,Bob",2\n',
    )
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      {
        date: '2026-03-01',
        title: 'Groceries',
        amount: 1250,
        paidBy: 'Alice',
        paidFor: ['Alice', 'Bob'],
        shares: [1, 1],
        category: '',
        notes: undefined,
      },
    ])
  })

  it('maps a Splitwise-style CSV', () => {
    const result = parseExpenseCsv(
      'Date,Description,Category,Cost,Currency,Paid by,Owed by\n2026/03/02,Taxi,Transport,20.00,USD,Alice,"Alice, Bob"\n',
    )
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      date: '2026-03-02',
      title: 'Taxi',
      amount: 2000,
      paidBy: 'Alice',
      paidFor: ['Alice', 'Bob'],
      shares: [1, 1],
    })
  })

  it('reports rows with invalid dates or amounts instead of dropping them silently', () => {
    const result = parseExpenseCsv(
      'date,title,amount,paid_by,paid_for\nnot-a-date,A,1,Alice,Alice\n2026-03-01,B,nope,Alice,Alice\n2026-03-01,C,2,,Alice\n',
    )
    expect(result.rows).toHaveLength(0)
    expect(result.errors.map((error) => error.message)).toEqual([
      'invalidDate',
      'invalidAmount',
      'missingPaidBy',
    ])
  })

  it('requires the core headers', () => {
    expect(parseExpenseCsv('foo,bar\n1,2\n')).toEqual({
      rows: [],
      errors: [{ line: 1, message: 'missingRequiredHeaders' }],
    })
  })

  it('handles an empty file', () => {
    expect(parseExpenseCsv('')).toEqual({
      rows: [],
      errors: [{ line: 0, message: 'emptyFile' }],
    })
  })
})
