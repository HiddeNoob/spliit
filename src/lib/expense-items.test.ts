import {
  apportionWeights,
  buildExpenseItemRows,
  getSharesFromItems,
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
        participants: [],
      },
      {
        id: 'id-1',
        name: 'Bread',
        quantity: 2,
        unitPrice: 125,
        total: 250,
        position: 1,
        participants: [],
      },
    ])
  })
})

describe('getSharesFromItems', () => {
  const ALL = ['a', 'b', 'c']

  it('charges each line to its assignee', () => {
    const shares = getSharesFromItems(
      [
        { name: 'Milk', quantity: 1, unitPrice: 1000, participants: ['a'] },
        { name: 'Bread', quantity: 1, unitPrice: 500, participants: ['b'] },
      ],
      ALL,
      1500,
    )
    expect(shares).toEqual(
      new Map([
        ['a', 1000],
        ['b', 500],
        ['c', 0],
      ]),
    )
  })

  it('splits a shared line between the people assigned to it', () => {
    const shares = getSharesFromItems(
      [{ name: 'Pizza', quantity: 1, unitPrice: 900, participants: ['a', 'b'] }],
      ALL,
      900,
    )
    expect(shares?.get('a')).toBe(450)
    expect(shares?.get('b')).toBe(450)
    expect(shares?.get('c')).toBe(0)
  })

  it('shares an unassigned line between everyone', () => {
    const shares = getSharesFromItems(
      [{ name: 'Water', quantity: 1, unitPrice: 300, participants: [] }],
      ALL,
      300,
    )
    expect([...shares!.values()].reduce((a, b) => a + b, 0)).toBe(300)
    expect(shares!.get('a')).toBe(100)
    expect(shares!.get('b')).toBe(100)
    expect(shares!.get('c')).toBe(100)
  })

  it('mixes personal and shared lines', () => {
    const shares = getSharesFromItems(
      [
        { name: 'Beer', quantity: 1, unitPrice: 1000, participants: ['a'] },
        { name: 'Chips', quantity: 1, unitPrice: 500, participants: ['b', 'c'] },
        { name: 'Ice', quantity: 1, unitPrice: 300, participants: [] },
      ],
      ALL,
      1800,
    )
    // Beer 1000 for a; chips 500 split b/c (250 each); ice 300 shared by
    // everyone (100 each) => weights 1100 / 350 / 350.
    expect(shares!.get('a')).toBe(1100)
    expect(shares!.get('b')).toBe(350)
    expect(shares!.get('c')).toBe(350)
    expect([...shares!.values()].reduce((x, y) => x + y, 0)).toBe(1800)
  })

  it('apportions a discounted total proportionally', () => {
    const shares = getSharesFromItems(
      [
        { name: 'A', quantity: 1, unitPrice: 1000, participants: ['a'] },
        { name: 'B', quantity: 1, unitPrice: 1000, participants: ['b'] },
      ],
      ALL,
      1500,
    )
    expect(shares!.get('a')).toBe(750)
    expect(shares!.get('b')).toBe(750)
    expect(shares!.get('c')).toBe(0)
  })

  it('always sums to the expense amount', () => {
    const shares = getSharesFromItems(
      [
        { name: 'A', quantity: 1, unitPrice: 333, participants: ['a', 'b'] },
        { name: 'B', quantity: 1, unitPrice: 333, participants: ['b', 'c'] },
      ],
      ALL,
      666,
    )
    expect([...shares!.values()].reduce((x, y) => x + y, 0)).toBe(666)
  })

  it('ignores unknown participants on a line', () => {
    const shares = getSharesFromItems(
      [{ name: 'A', quantity: 1, unitPrice: 900, participants: ['ghost'] }],
      ALL,
      900,
    )
    // Falls back to sharing among the real participants.
    expect(shares!.get('a')).toBe(300)
  })

  it('returns null without items or participants', () => {
    expect(getSharesFromItems([], ALL, 1000)).toBeNull()
    expect(
      getSharesFromItems([{ name: 'A', quantity: 1, unitPrice: 100 }], [], 100),
    ).toBeNull()
  })
})

describe('apportionWeights', () => {
  it('sums exactly to the amount', () => {
    expect(apportionWeights(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(
      100,
    )
    expect(
      apportionWeights(1000, [1, 2, 3]).reduce((a, b) => a + b, 0),
    ).toBe(1000)
  })

  it('splits evenly when there are no weights', () => {
    expect(apportionWeights(10, [0, 0])).toEqual([5, 5])
  })

  it('handles negative amounts', () => {
    expect(
      apportionWeights(-100, [1, 1]).reduce((a, b) => a + b, 0),
    ).toBe(-100)
  })
})
