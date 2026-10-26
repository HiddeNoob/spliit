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
  /**
   * Participants this line belongs to. Empty means "everyone on the expense".
   * Used to split a receipt by product.
   */
  participants?: string[]
}

export type ExpenseItemValidationError =
  'invalidName' | 'invalidQuantity' | 'invalidPrice'

/**
 * Validates a list of line items without touching the database. Budgets are
 * capped so a malformed model response or a hostile request cannot create an
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
  participants: string[]
}[] {
  return items.map((item, index) => ({
    id: createId(),
    name: item.name.trim(),
    quantity: normalizeQuantity(parseQuantity(item.quantity)),
    unitPrice: Math.round(Number(item.unitPrice)),
    total: getLineItemTotal(item) ?? 0,
    position: index,
    participants: item.participants ?? [],
  }))
}

/**
 * Per-participant amounts derived from the product lines.
 *
 * Each line is divided evenly between the participants assigned to it; a line
 * with no assignees is shared by everyone on the expense. The caller passes the
 * expense total, so the result always adds up to it exactly — a receipt with a
 * discount or a rounding difference is apportioned proportionally rather than
 * rejected.
 *
 * Returns `null` when there is nothing to derive a split from (no lines, no
 * totals, no participants).
 */
export function getSharesFromItems(
  items: {
    name?: string
    quantity: number | string
    unitPrice: number
    participants?: string[]
  }[],
  allParticipantIds: string[],
  amount: number,
): Map<string, number> | null {
  if (allParticipantIds.length === 0) return null

  const weights = new Map<string, number>()
  for (const participantId of allParticipantIds) weights.set(participantId, 0)

  let totalWeight = 0
  for (const item of items) {
    const lineTotal = getLineItemTotal(item)
    if (lineTotal === null || lineTotal === 0) continue

    // Unknown ids are dropped: the expense's participant list is authoritative.
    const assignees = (item.participants ?? []).filter((participantId) =>
      weights.has(participantId),
    )
    const beneficiaries =
      assignees.length > 0 ? assignees : allParticipantIds
    totalWeight += lineTotal

    // Distribute this line with the same remainder rule as the final split, so
    // a line shared by three people does not lose a cent.
    for (const [participantId, share] of apportion(lineTotal, beneficiaries)) {
      weights.set(participantId, weights.get(participantId)! + share)
    }
  }

  if (totalWeight === 0) return null

  // Apportion the actual expense amount (which may differ from the lines) by
  // the weights, guaranteeing the shares add up to `amount`.
  const ordered = allParticipantIds.map(
    (participantId) => weights.get(participantId) ?? 0,
  )
  const shares = apportionWeights(amount, ordered)

  const result = new Map<string, number>()
  allParticipantIds.forEach((participantId, index) => {
    result.set(participantId, shares[index])
  })
  return result
}

/**
 * Splits `amount` across recipients as evenly as possible, largest-remainder
 * style, so the parts sum to `amount` exactly.
 */
function apportion(amount: number, recipients: string[]): [string, number][] {
  const shares = apportionWeights(
    amount,
    recipients.map(() => 1),
  )
  return recipients.map((recipient, index) => [recipient, shares[index]])
}

/**
 * Distributes `amount` proportionally to `weights`, with the leftover minor
 * units handed to the entries with the largest remainders (ties go to the
 * first). Negative amounts (income) keep the leftover non-negative too.
 */
export function apportionWeights(amount: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total === 0) {
    // No weights at all: fall back to an even split.
    return apportionWeights(
      amount,
      weights.map(() => 1),
    )
  }

  const exact = weights.map((weight) => (amount * weight) / total)
  const floors = exact.map((value) => Math.floor(value))
  let remainder = amount - floors.reduce((sum, value) => sum + value, 0)

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  const result = [...floors]
  let cursor = 0
  while (remainder > 0 && order.length > 0) {
    result[order[cursor % order.length].index] += 1
    remainder -= 1
    cursor += 1
  }
  return result
}
