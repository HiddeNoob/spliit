/**
 * Helpers for expense line items (products on a receipt).
 *
 * Money is handled in minor units (cents) everywhere, and quantities may be
 * fractional (1.5 kg). A line total is therefore `round(unitPrice × quantity)`,
 * rounded only once so that summing the lines never drifts from the rounding
 * shown to the user.
 */

export type ExpenseItemLike = {
  name: string
  quantity: number | string
  unitPrice: number
}

const MAX_QUANTITY = 1_000_000
const MAX_ITEM_PRICE = 10_000_000_00
const MAX_ITEMS = 500

/** Parses a quantity that may come from an input as a comma-decimal string. */
export function parseQuantity(value: number | string): number {
  if (typeof value === 'number') return value
  const normalized = value.trim().replace(',', '.')
  if (normalized === '') return Number.NaN
  return Number(normalized)
}

/**
 * The total of one line in minor units. Returns `null` when the quantity is
 * invalid (non-finite, zero, negative or unreasonably large) so callers can
 * distinguish "not filled in yet" from a legitimate zero.
 */
export function getLineItemTotal(item: {
  quantity: number | string
  unitPrice: number
}): number | null {
  const quantity = parseQuantity(item.quantity)
  const unitPrice = Number(item.unitPrice)
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null
  return Math.round(unitPrice * quantity)
}

/** Sum of all valid line totals, in minor units. */
export function getItemsTotal(items: ExpenseItemLike[]): number {
  return items.reduce((sum, item) => {
    const total = getLineItemTotal(item)
    return total === null ? sum : sum + total
  }, 0)
}

/** Quantity is stored with three decimals, so 1.5 stays exact. */
export function normalizeQuantity(quantity: number): number {
  return Math.round(quantity * 1000) / 1000
}

export type ExpenseItemInput = {
  name: string
  quantity: number | string
  unitPrice: number
}

export type ExpenseItemValidationError =
  'invalidName' | 'invalidQuantity' | 'invalidPrice'

/**
 * Validates a list of line items without touching the database. Budgets are
 * capped so a malformed OCR response or a hostile request cannot create an
 * unbounded number of rows.
 */
export function validateExpenseItems(
  items: ExpenseItemInput[],
): ExpenseItemValidationError | null {
  if (items.length > MAX_ITEMS) return 'invalidName'
  for (const item of items) {
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (name.length === 0 || name.length > 200) return 'invalidName'

    const quantity = parseQuantity(item.quantity)
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > MAX_QUANTITY
    ) {
      return 'invalidQuantity'
    }

    const unitPrice = Number(item.unitPrice)
    if (
      !Number.isFinite(unitPrice) ||
      !Number.isInteger(unitPrice) ||
      unitPrice < 0 ||
      unitPrice > MAX_ITEM_PRICE
    ) {
      return 'invalidPrice'
    }
  }
  return null
}

/**
 * Builds the database rows for an expense. Ids are minted by the caller so this
 * stays a pure function and is easy to test.
 */
export function buildExpenseItemRows(
  items: ExpenseItemInput[],
  createId: () => string,
): {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
  position: number
}[] {
  return items.map((item, index) => ({
    id: createId(),
    name: item.name.trim(),
    quantity: normalizeQuantity(parseQuantity(item.quantity)),
    unitPrice: Math.round(Number(item.unitPrice)),
    total: getLineItemTotal(item) ?? 0,
    position: index,
  }))
}
