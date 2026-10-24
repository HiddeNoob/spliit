import { guessReceiptCategoryId } from './receipt-category'

const categories = [
  { id: 0, grouping: 'Uncategorized', name: 'General' },
  { id: 9, grouping: 'Food and Drink', name: 'Groceries' },
  { id: 8, grouping: 'Food and Drink', name: 'Dining Out' },
  { id: 10, grouping: 'Food and Drink', name: 'Liquor' },
  { id: 35, grouping: 'Transportation', name: 'Taxi' },
  { id: 31, grouping: 'Transportation', name: 'Gas/Fuel' },
  { id: 25, grouping: 'Life', name: 'Medical Expenses' },
  { id: 38, grouping: 'Utilities', name: 'Electricity' },
]

describe('guessReceiptCategoryId', () => {
  it('recognises a supermarket receipt', () => {
    expect(
      guessReceiptCategoryId(
        'MIGROS\nEKMEK 2 x 12,50\nSUT 1 x 28,00\nDOMATES 1,5 kg x 24,90',
        categories,
      ),
    ).toBe(9)
  })

  it('prefers groceries for a corner shop selling bread', () => {
    expect(guessReceiptCategoryId('KOSE MARKET\nEKMEK 12,50', categories)).toBe(
      9,
    )
  })

  it('recognises a restaurant', () => {
    expect(
      guessReceiptCategoryId('KAFE MERKEZ\nKAHVALTI 250,00', categories),
    ).toBe(8)
  })

  it('recognises a taxi', () => {
    expect(guessReceiptCategoryId('BITAKSI\nYOLCULUK 120,00', categories)).toBe(
      35,
    )
  })

  it('recognises fuel', () => {
    expect(guessReceiptCategoryId('OPET\nBENZIN 45,20 LT', categories)).toBe(31)
  })

  it('recognises an electricity bill', () => {
    expect(
      guessReceiptCategoryId('ENERJISA\nELEKTRIK FATURASI', categories),
    ).toBe(38)
  })

  it('returns 0 when nothing matches', () => {
    expect(guessReceiptCategoryId('XYZ GIDA', categories)).toBe(0)
    expect(guessReceiptCategoryId('', categories)).toBe(0)
  })

  it('does not match a keyword inside another word', () => {
    // "su" must not fire on "sucuk"; no other keyword is present here.
    expect(guessReceiptCategoryId('SUCUK 45,00', categories)).toBe(0)
  })

  it('ignores categories that are not in the provided list', () => {
    expect(
      guessReceiptCategoryId('MIGROS EKMEK', [
        { id: 0, grouping: 'Uncategorized', name: 'General' },
      ]),
    ).toBe(0)
  })
})
