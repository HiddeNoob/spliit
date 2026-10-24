/**
 * Parses the plain text returned by an OCR service into the fields the
 * receipt flow needs: merchant, date, title, total and product lines.
 *
 * The parser is deliberately deterministic and conservative. An OCR model
 * returns something close to the printed receipt, but with no guarantees about
 * column alignment: totals, tax lines and payment methods are interleaved with
 * products. Guessing is worse than returning nothing, because the user is
 * shown the result and can edit it before saving — a wrong product line is
 * easy to miss, an empty list is not.
 */

export type ParsedReceiptItem = {
  name: string
  /** Units, or a decimal weight for products sold by kg/litre. */
  quantity: number
  /** Unit price in major units of the receipt currency. */
  unitPrice: number
}

export type ParsedReceipt = {
  merchant: string | null
  /** `YYYY-MM-DD`, or null when the text has no recognisable date. */
  date: string | null
  title: string | null
  /** Total in major units, or null when it could not be read. */
  total: number | null
  items: ParsedReceiptItem[]
}

/** Upper bound for a single printed amount, in major units. */
const MAX_RECEIPT_AMOUNT = 10_000_000

/** Lines that are never products, matched case-insensitively. */
const NON_PRODUCT_PATTERNS = [
  /\b(toplam|total|tutar|ara\s*toplam|subtotal|sub\s*total|genel\s*toplam)\b/i,
  /\b(kdv|vat|tax|vergi)\b/i,
  /\b(indirim|iskonto|discount|kampanya)\b/i,
  /\b(nakit|cash|kart|card|kredi\s*kart[ıi]|debit|pos|visa|mastercard|troy)\b/i,
  /\b(para\s*üstü|para\s*ustu|change|balance|kalan)\b/i,
  /\b(iade|refund)\b/i,
  /\b(fi[sş]\s*(no|numaras[ıi])|receipt|invoice|fatura|müşteri|musteri)\b/i,
  /\b(tarih|date|saat|time|kasiyer|cashier|şube|sube|tel|telefon|www\.|http)\b/i,
]

const CURRENCY_SUFFIX = String.raw`(?:\s*(?:tl|try|₺|\$|€|usd|eur|gbp|£))?`

/** Units that may follow the quantity on a product line. */
const UNIT = String.raw`(?:kg|gr|g|lt|l|ml|cl|adet|ad|pcs|paket|pk|kutu|şişe|sise)`

const NUMBER = String.raw`\d+(?:[.,]\d+)?`

/**
 * `NAME 2 x 12.50 25.00`, `DOMATES 1.5 kg x 24.90 37.35`,
 * `SUT 1 L 3 x 28.00 84.00` (the leading "1 L" stays part of the name).
 */
const QUANTITY_TIMES_UNIT_PRICE = new RegExp(
  String.raw`^(.+?)\s+(${NUMBER})\s*${UNIT}?\s*[x×*]\s*(${NUMBER})${CURRENCY_SUFFIX}(?:\s+(${NUMBER})${CURRENCY_SUFFIX})?$`,
  'i',
)

/** `EKMEK 12.50` — a single trailing amount, i.e. quantity 1. */
const NAME_AMOUNT = new RegExp(
  String.raw`^(.+?)\s+(${NUMBER})${CURRENCY_SUFFIX}$`,
  'i',
)

const DATE_PATTERNS: {
  pattern: RegExp
  /** Maps the match to [year, month, day]. */
  extract: (match: RegExpMatchArray) => [string, string, string]
}[] = [
  {
    // 2026-10-24, also inside a timestamp
    pattern: /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/,
    extract: (match) => [match[1], match[2], match[3]],
  },
  {
    // 24.10.2026 — day first, the common Turkish and European order.
    pattern: /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/,
    extract: (match) => [match[3], match[2], match[1]],
  },
]

function buildIso(
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
): string | null {
  if (!year || !month || !day) return null
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null
  }
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const candidate = new Date(Date.UTC(y, m - 1, d))
  // Rejects 31 February, which Date would silently roll over.
  if (candidate.getUTCMonth() !== m - 1 || candidate.getUTCDate() !== d) {
    return null
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Reads a number printed on a receipt, handling both `1.234,56` (Turkish /
 * European) and `1,234.56` (Anglo) grouping, and plain decimals.
 *
 * The last separator counts as the decimal separator when it is followed by
 * one or two digits; otherwise every separator is grouping.
 */
export function parseReceiptAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/[^\d.,-]/g, '')
    .replace(/^-/, '')
    .trim()
  if (cleaned === '') return null

  const lastSeparator = Math.max(
    cleaned.lastIndexOf(','),
    cleaned.lastIndexOf('.'),
  )
  if (lastSeparator === -1) {
    const value = Number(cleaned)
    if (!Number.isFinite(value) || value > MAX_RECEIPT_AMOUNT) return null
    return value
  }

  const fractionDigits = cleaned.length - lastSeparator - 1
  // Three digits after the last separator means grouping (1.234), not cents.
  const isDecimal = fractionDigits > 0 && fractionDigits <= 2

  let normalized: string
  if (isDecimal) {
    const integerPart = cleaned.slice(0, lastSeparator).replace(/[.,]/g, '')
    const fractionPart = cleaned.slice(lastSeparator + 1)
    normalized = `${integerPart}.${fractionPart}`
  } else {
    normalized = cleaned.replace(/[.,]/g, '')
  }

  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  // Guard against OCR noise turning a receipt into a lottery win.
  if (value > MAX_RECEIPT_AMOUNT) return null
  return Math.round(value * 100) / 100
}

/**
 * Quantities allow up to three decimals (0.75 kg, 1.500 kg), so they need a
 * different grouping rule than money: three digits after the separator are a
 * fraction, not a thousands group.
 */
export function parseReceiptQuantity(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '').trim()
  if (cleaned === '') return null
  const lastSeparator = Math.max(
    cleaned.lastIndexOf(','),
    cleaned.lastIndexOf('.'),
  )
  let normalized: string
  if (lastSeparator === -1) {
    normalized = cleaned
  } else {
    const fractionDigits = cleaned.length - lastSeparator - 1
    if (fractionDigits > 3) return null
    normalized =
      cleaned.slice(0, lastSeparator).replace(/[.,]/g, '') +
      '.' +
      cleaned.slice(lastSeparator + 1)
  }
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0 || value > 10_000) return null
  return Math.round(value * 1000) / 1000
}

function stripDecoration(line: string): string {
  return line
    .replace(/[*_`>]/g, ' ')
    .replace(/^[#\-\s•·]+/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNonProductLine(line: string): boolean {
  return NON_PRODUCT_PATTERNS.some((pattern) => pattern.test(line))
}

/** True when the line looks like a product name rather than noise. */
function looksLikeProductName(name: string): boolean {
  const letters = name.replace(/[^\p{L}]/gu, '')
  return letters.length >= 2 && name.length <= 120
}

/**
 * Finds the receipt total. An explicit `TOPLAM`/`TOTAL` line wins; otherwise
 * the largest amount printed on a total-like line; otherwise null.
 */
function findTotal(lines: string[]): number | null {
  const totalLines = lines.filter((line) =>
    /\b(toplam|total|tutar|genel\s*toplam)\b/i.test(line),
  )
  const explicit = totalLines
    .map((line) => {
      const amounts = line.match(new RegExp(NUMBER, 'g')) ?? []
      // The total is usually the last (and largest) number on the line.
      const parsed = amounts
        .map(parseReceiptAmount)
        .filter((value): value is number => value !== null)
      return parsed.length === 0 ? null : Math.max(...parsed)
    })
    .filter((value): value is number => value !== null)

  if (explicit.length > 0) return Math.max(...explicit)
  return null
}

function findDate(text: string): string | null {
  for (const { pattern, extract } of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const [year, month, day] = extract(match)
      const iso = buildIso(year, month, day)
      if (iso) return iso
    }
  }
  return null
}

/**
 * Parses one product line. Returns null when the line has no amount, or when
 * its shape indicates a total/tax/payment line instead of a product.
 */
export function parseReceiptItemLine(line: string): ParsedReceiptItem | null {
  const cleaned = stripDecoration(line)
  if (cleaned === '' || isNonProductLine(cleaned)) return null
  if (!/\d/.test(cleaned)) return null

  const quantityMatch = cleaned.match(QUANTITY_TIMES_UNIT_PRICE)
  if (quantityMatch) {
    const name = quantityMatch[1].trim()
    const quantity = parseReceiptQuantity(quantityMatch[2])
    const unitPrice = parseReceiptAmount(quantityMatch[3])
    if (
      looksLikeProductName(name) &&
      quantity !== null &&
      quantity > 0 &&
      quantity <= 10_000 &&
      unitPrice !== null
    ) {
      return {
        name,
        quantity: Math.round(quantity * 1000) / 1000,
        unitPrice,
      }
    }
  }

  const amountMatch = cleaned.match(NAME_AMOUNT)
  if (amountMatch) {
    const name = amountMatch[1].trim()
    const unitPrice = parseReceiptAmount(amountMatch[2])
    if (looksLikeProductName(name) && unitPrice !== null && unitPrice > 0) {
      return { name, quantity: 1, unitPrice }
    }
  }

  return null
}

/** Reads a merchant name: the first meaningful line of the receipt. */
function findMerchant(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    const cleaned = stripDecoration(line)
    if (cleaned === '') continue
    if (/\d/.test(cleaned)) continue
    if (isNonProductLine(cleaned)) continue
    const letters = cleaned.replace(/[^\p{L}]/gu, '')
    if (letters.length >= 3 && cleaned.length <= 80) return cleaned
  }
  return null
}

/**
 * Parses the OCR output. Lines are interpreted in order, so a product listed
 * twice stays as two rows; callers may merge them if they prefer.
 */
export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')

  const merchant = findMerchant(lines)
  const date = findDate(text)
  const total = findTotal(lines)

  const items: ParsedReceiptItem[] = []
  for (const line of lines) {
    const item = parseReceiptItemLine(line)
    if (item) items.push(item)
  }

  // Keep the returned total consistent with the lines whenever possible: if
  // OCR missed the total line, the products are the best available estimate.
  const itemsTotal =
    Math.round(
      items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) *
        100,
    ) / 100
  const resolvedTotal = total ?? (itemsTotal > 0 ? itemsTotal : null)

  return {
    merchant,
    date,
    title: merchant,
    // `total` is what will prefill the amount, so prefer the explicit printed
    // total; a mismatch with the products is surfaced by the form's total line.
    total: resolvedTotal,
    items,
  }
}
