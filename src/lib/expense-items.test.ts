import {
  buildExpenseItemRows,
  getItemsTotal,
  getLineItemTotal,
  normalizeQuantity,
  parseQuantity,
  validateExpenseItems,
} from './expense-items'

describe('parseQuantity', () => {
  it('accepts numbers and comma decimals', () => {
    expect(parseQuantity(1.5)).toBe(1.5)
    expect(parseQuantity('1,5')).toBe(1.5)
    expect(parseQuantity(' 2 ')).toBe(2)
  })

  it('returns NaN for empty or non-numeric input', () => {
    expect(parseQuantity('')).toBeNaN()
    expect(parseQuantity('abc')).toBeNaN()
  })
})

describe('getLineItemTotal', () => {
  it('multiplies whole quantities', () => {
    expect(getLineItemTotal({ quantity: 2, unitPrice: 125 })).toBe(250)
  })

  it('supports weighed products and rounds once', () => {
    expect(getLineItemTotal({ quantity: 1.5, unitPrice: 250 })).toBe(375)
    expect(getLineItemTotal({ quantity: 0.333, unitPrice: 100 })).toBe(33)
  })

  it('returns null for invalid quantities or prices', () => {
    expect(getLineItemTotal({ quantity: 0, unitPrice: 100 })).toBeNull()
    expect(getLineItemTotal({ quantity: -1, unitPrice: 100 })).toBeNull()
    expect(getLineItemTotal({ quantity: 'x', unitPrice: 100 })).toBeNull()
    expect(getLineItemTotal({ quantity: 1, unitPrice: -5 })).toBeNull()
  })

  it('keeps free items at zero', () => {
    expect(getLineItemTotal({ quantity: 1, unitPrice: 0 })).toBe(0)
  })
})

describe('getItemsTotal', () => {
  it('sums valid lines and ignores invalid ones', () => {
    expect(
      getItemsTotal([
        { name: 'a', quantity: 2, unitPrice: 100 },
        { name: 'b', quantity: 0.5, unitPrice: 300 },
        { name: 'c', quantity: 0, unitPrice: 999 },
      ]),
    ).toBe(350)
  })

  it('returns zero for no items', () => {
    expect(getItemsTotal([])).toBe(0)
  })
})

describe('normalizeQuantity', () => {
  it('keeps three decimals', () => {
    expect(normalizeQuantity(1.23456)).toBe(1.235)
    expect(normalizeQuantity(2)).toBe(2)
  })
})

describe('validateExpenseItems', () => {
  it('accepts a well-formed list', () => {
    expect(
      validateExpenseItems([
        { name: 'Milk', quantity: 2, unitPrice: 150 },
        { name: 'Apples', quantity: 1.25, unitPrice: 300 },
      ]),
    ).toBeNull()
  })

  it('rejects an empty name', () => {
    expect(
      validateExpenseItems([{ name: '  ', quantity: 1, unitPrice: 1 }]),
    ).toBe('invalidName')
  })

  it('rejects an invalid quantity', () => {
    expect(
      validateExpenseItems([{ name: 'x', quantity: 0, unitPrice: 1 }]),
    ).toBe('invalidQuantity')
  })

  it('rejects a non-integer or negative price', () => {
    expect(
      validateExpenseItems([{ name: 'x', quantity: 1, unitPrice: 1.5 }]),
    ).toBe('invalidPrice')
    expect(
      validateExpenseItems([{ name: 'x', quantity: 1, unitPrice: -1 }]),
    ).toBe('invalidPrice')
  })
})

describe('buildExpenseItemRows', () => {
  it('mints ids, trims names and stores totals in minor units', () => {
    let n = 0
    const rows = buildExpenseItemRows(
      [
        { name: ' Tomatoes ', quantity: '1,5', unitPrice: 250 },
        { name: 'Bread', quantity: 2, unitPrice: 125 },
      ],
      () => `id-${n++}`,
    )

    expect(rows).toEqual([
      {
        id: 'id-0',
        name: 'Tomatoes',
        quantity: 1.5,
        unitPrice: 250,
        total: 375,
        position: 0,
      },
      {
        id: 'id-1',
        name: 'Bread',
        quantity: 2,
        unitPrice: 125,
        total: 250,
        position: 1,
      },
    ])
  })
})
