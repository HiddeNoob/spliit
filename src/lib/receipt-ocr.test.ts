import {
  parseReceiptAmount,
  parseReceiptItemLine,
  parseReceiptQuantity,
  parseReceiptText,
} from './receipt-ocr'

describe('parseReceiptAmount', () => {
  it('reads plain decimals', () => {
    expect(parseReceiptAmount('191.35')).toBe(191.35)
    expect(parseReceiptAmount('5')).toBe(5)
  })

  it('reads comma decimals', () => {
    expect(parseReceiptAmount('191,35')).toBe(191.35)
  })

  it('reads Turkish grouping and decimals', () => {
    expect(parseReceiptAmount('1.234,56')).toBe(1234.56)
  })

  it('reads Anglo grouping and decimals', () => {
    expect(parseReceiptAmount('1,234.56')).toBe(1234.56)
  })

  it('treats three trailing digits as grouping', () => {
    expect(parseReceiptAmount('1.234')).toBe(1234)
  })

  it('ignores currency symbols and text', () => {
    expect(parseReceiptAmount('191,35 TL')).toBe(191.35)
    expect(parseReceiptAmount('$ 12.50')).toBe(12.5)
  })

  it('rejects empty or absurd values', () => {
    expect(parseReceiptAmount('')).toBeNull()
    expect(parseReceiptAmount('TL')).toBeNull()
    expect(parseReceiptAmount('99999999999')).toBeNull()
  })
})

describe('parseReceiptQuantity', () => {
  it('keeps fractional weights', () => {
    expect(parseReceiptQuantity('1,5')).toBe(1.5)
    expect(parseReceiptQuantity('0.75')).toBe(0.75)
    expect(parseReceiptQuantity('1.500')).toBe(1.5)
  })

  it('reads whole quantities', () => {
    expect(parseReceiptQuantity('2')).toBe(2)
  })

  it('rejects zero, negative and too-precise values', () => {
    expect(parseReceiptQuantity('0')).toBeNull()
    expect(parseReceiptQuantity('1.2345')).toBeNull()
  })
})

describe('parseReceiptItemLine', () => {
  it('reads quantity × unit price with a line total', () => {
    expect(parseReceiptItemLine('EKMEK 2 x 12.50 25.00')).toEqual({
      name: 'EKMEK',
      quantity: 2,
      unitPrice: 12.5,
    })
  })

  it('reads weighed products with a unit', () => {
    expect(parseReceiptItemLine('DOMATES 1.5 kg x 24.90 37.35')).toEqual({
      name: 'DOMATES',
      quantity: 1.5,
      unitPrice: 24.9,
    })
  })

  it('keeps a leading volume as part of the name', () => {
    expect(parseReceiptItemLine('SUT 1 L 3 x 28.00 84.00')).toEqual({
      name: 'SUT 1 L',
      quantity: 3,
      unitPrice: 28,
    })
  })

  it('reads a single amount as quantity 1', () => {
    expect(parseReceiptItemLine('PECETE 45,00')).toEqual({
      name: 'PECETE',
      quantity: 1,
      unitPrice: 45,
    })
  })

  it('ignores totals, tax and payment lines', () => {
    expect(parseReceiptItemLine('TOPLAM 191.35 TL')).toBeNull()
    expect(parseReceiptItemLine('KDV %20 31.89')).toBeNull()
    expect(parseReceiptItemLine('KART 191.35')).toBeNull()
    expect(parseReceiptItemLine('ARA TOPLAM 160.00')).toBeNull()
    expect(parseReceiptItemLine('NAKIT 50.00')).toBeNull()
  })

  it('ignores lines without an amount', () => {
    expect(parseReceiptItemLine('KOSE MARKET')).toBeNull()
  })
})

describe('parseReceiptText', () => {
  const receipt = `# KOSE MARKET

Tarih: 2026-10-24 14:32

DOMATES 1.5 kg x 24.90 37.35
EKMEK 2 x 12.50 25.00
SUT 1 L 3 x 28.00 84.00
PECETE 1 x 45.00 45.00

TOPLAM 191.35 TL

KART 191.35`

  it('extracts merchant, date, total and every product', () => {
    expect(parseReceiptText(receipt)).toEqual({
      merchant: 'KOSE MARKET',
      date: '2026-10-24',
      title: 'KOSE MARKET',
      total: 191.35,
      items: [
        { name: 'DOMATES', quantity: 1.5, unitPrice: 24.9 },
        { name: 'EKMEK', quantity: 2, unitPrice: 12.5 },
        { name: 'SUT 1 L', quantity: 3, unitPrice: 28 },
        { name: 'PECETE', quantity: 1, unitPrice: 45 },
      ],
    })
  })

  it('reads a day-first date', () => {
    expect(parseReceiptText('MARKET A\n24.10.2026\nTOPLAM 10,00').date).toBe(
      '2026-10-24',
    )
  })

  it('falls back to the products sum when the total is missing', () => {
    const parsed = parseReceiptText('MARKET\nEKMEK 2 x 10.00\nSUT 1 x 5.00')
    expect(parsed.total).toBe(25)
    expect(parsed.items).toHaveLength(2)
  })

  it('returns nulls for a receipt it cannot read', () => {
    expect(parseReceiptText('')).toEqual({
      merchant: null,
      date: null,
      title: null,
      total: null,
      items: [],
    })
  })

  it('rejects an impossible date', () => {
    expect(parseReceiptText('MARKET\n31.02.2026\nTOPLAM 5,00').date).toBeNull()
  })

  it('does not treat the total as a product', () => {
    const parsed = parseReceiptText('MARKET\nTOPLAM 100,00')
    expect(parsed.items).toEqual([])
    expect(parsed.total).toBe(100)
  })
})
