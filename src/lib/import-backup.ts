import { z } from 'zod'

/**
 * Versioned backup format for a whole group. Amounts are minor units and dates
 * are `YYYY-MM-DD`, matching the database and the rest of the app.
 */
export const backupSchemaVersion = 1

const backupParticipantSchema = z.object({
  name: z.string().min(1).max(200),
  // Only used to remap references inside the file; replaced on import.
  ref: z.string().min(1),
})

const backupExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().int(),
  originalAmount: z.number().int().nullish(),
  originalCurrency: z.string().max(3).nullish(),
  conversionRate: z.number().nullish(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.number().int().default(0),
  paidByRef: z.string().min(1),
  paidFor: z
    .array(
      z.object({
        participantRef: z.string().min(1),
        shares: z.number().int(),
      }),
    )
    .min(1),
  splitMode: z
    .enum(['EVENLY', 'BY_SHARES', 'BY_PERCENTAGE', 'BY_AMOUNT'])
    .default('EVENLY'),
  isReimbursement: z.boolean().default(false),
  notes: z.string().nullish(),
  merchant: z.string().max(200).nullish(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        quantity: z.number().positive(),
        unitPrice: z.number().int().min(0),
        total: z.number().int().min(0),
        position: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  documents: z
    .array(
      z.object({
        url: z.string().url(),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
      }),
    )
    .default([]),
})

export const groupBackupSchema = z.object({
  schemaVersion: z.literal(backupSchemaVersion),
  exportedAt: z.string(),
  group: z.object({
    name: z.string().min(2).max(50),
    information: z.string().nullish(),
    currency: z.string().min(1).max(5),
    currencyCode: z.string().length(3).nullish(),
    showFutureExpenses: z.boolean().default(true),
    participants: z.array(backupParticipantSchema).min(1).max(500),
    expenses: z.array(backupExpenseSchema).max(5000).default([]),
  }),
})

export type GroupBackup = z.infer<typeof groupBackupSchema>

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

/**
 * Parses and validates a backup file. Returns a discriminated result so the UI
 * can show a concrete error instead of a thrown exception.
 */
export function parseGroupBackup(
  text: string,
  options: { categoryIds?: Set<number> } = {},
): { ok: true; backup: GroupBackup } | { ok: false; error: string } {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'fileTooLarge' }
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalidJson' }
  }

  const parsed = groupBackupSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, error: 'invalidBackup' }
  }

  const backup = parsed.data
  const refs = new Set(backup.group.participants.map((p) => p.ref))
  for (const expense of backup.group.expenses) {
    if (!refs.has(expense.paidByRef))
      return { ok: false, error: 'unknownPaidBy' }
    if (expense.paidFor.some((p) => !refs.has(p.participantRef))) {
      return { ok: false, error: 'unknownParticipant' }
    }
    if (options.categoryIds && !options.categoryIds.has(expense.categoryId)) {
      return { ok: false, error: 'unknownCategory' }
    }
  }
  return { ok: true, backup }
}

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes,
 * commas and newlines inside quotes, and CRLF line endings. Returns rows of
 * raw strings; callers map the header themselves.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

export type CsvExpenseRow = {
  date: string
  title: string
  amount: number
  paidBy: string
  paidFor: string[]
  shares: number[]
  category: string
  notes?: string
}

export type CsvParseResult = {
  rows: CsvExpenseRow[]
  errors: { line: number; message: string }[]
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseAmount(value: string): number | null {
  const normalized = value
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  if (normalized === '') return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100)
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim()
  // ISO first, then common D/M/Y and M/D/Y forms are ambiguous; require ISO or
  // unambiguous YYYY/MM/DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const slash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slash) {
    return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`
  }
  return null
}

/**
 * Maps a generic or Splitwise-style CSV to expense rows. Splitwise exports
 * use "Date", "Description", "Category", "Cost", "Currency" and either
 * "Paid by" / "Owed by" or the simplified "paid_by" / "paid_for" columns.
 * Required headers are reported as a single error row.
 */
export function parseExpenseCsv(text: string): CsvParseResult {
  const table = parseCsv(text)
  const errors: CsvParseResult['errors'] = []
  if (table.length === 0) {
    return { rows: [], errors: [{ line: 0, message: 'emptyFile' }] }
  }

  const headers = table[0].map(normalizeHeader)
  const index = (name: string) => headers.indexOf(name)
  const dateIndex = index('date') !== -1 ? index('date') : index('expense_date')
  const titleIndex =
    index('description') !== -1 ? index('description') : index('title')
  const amountIndex =
    index('cost') !== -1
      ? index('cost')
      : index('amount') !== -1
        ? index('amount')
        : index('total')
  const paidByIndex =
    index('paid_by') !== -1 ? index('paid_by') : index('paidby')
  const paidForIndex =
    index('paid_for') !== -1 ? index('paid_for') : index('owed_by')
  const categoryIndex = index('category')
  const notesIndex = index('notes')
  const sharesIndex = index('shares')

  if (dateIndex === -1 || titleIndex === -1 || amountIndex === -1) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'missingRequiredHeaders' }],
    }
  }

  const rows: CsvExpenseRow[] = []
  for (let i = 1; i < table.length; i++) {
    const raw = table[i]
    const line = i + 1
    const date = normalizeDate(raw[dateIndex] ?? '')
    if (!date) {
      errors.push({ line, message: 'invalidDate' })
      continue
    }
    const amount = parseAmount(raw[amountIndex] ?? '')
    if (amount === null) {
      errors.push({ line, message: 'invalidAmount' })
      continue
    }
    const title = (raw[titleIndex] ?? '').trim()
    if (!title) {
      errors.push({ line, message: 'missingTitle' })
      continue
    }
    const paidBy = (paidByIndex === -1 ? '' : (raw[paidByIndex] ?? '')).trim()
    if (!paidBy) {
      errors.push({ line, message: 'missingPaidBy' })
      continue
    }
    // Splitwise's "Owed by" is a comma-separated list of names.
    const paidFor = (paidForIndex === -1 ? '' : (raw[paidForIndex] ?? ''))
      .split(';')
      .flatMap((part) => part.split(','))
      .map((part) => part.trim())
      .filter(Boolean)
    if (paidFor.length === 0) {
      errors.push({ line, message: 'missingPaidFor' })
      continue
    }

    const sharesRaw = sharesIndex === -1 ? '' : (raw[sharesIndex] ?? '')
    const shares = sharesRaw
      ? sharesRaw.split(/[;,]/).map((value) => Number(value) || 1)
      : paidFor.map(() => 1)

    rows.push({
      date,
      title,
      amount,
      paidBy,
      paidFor,
      shares: shares.length === paidFor.length ? shares : paidFor.map(() => 1),
      category: (categoryIndex === -1 ? '' : (raw[categoryIndex] ?? '')).trim(),
      notes:
        (notesIndex === -1 ? '' : (raw[notesIndex] ?? '')).trim() || undefined,
    })
  }

  return { rows, errors }
}
