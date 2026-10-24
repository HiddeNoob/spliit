import type { ReceiptExtractedItem } from '@/app/groups/[groupId]/expenses/create-from-receipt-button-actions'

/**
 * A receipt scan is handed from the scan dialog to the expense form through
 * sessionStorage. Line items can be long, and putting them in the URL would
 * both bloat it and leak product names into browser history and logs.
 */
export type ReceiptDraft = {
  title: string | null
  amount: number | null
  categoryId: string | null
  date: string | null
  merchant: string | null
  items: ReceiptExtractedItem[]
  imageUrl: string
  imageWidth?: number
  imageHeight?: number
}

const PREFIX = 'spliit-receipt-draft-'

/** A draft older than this is stale and is cleaned up on the next scan. */
const MAX_AGE_MS = 60 * 60 * 1000

type StoredDraft = { savedAt: number; draft: ReceiptDraft }

export function saveReceiptDraft(draft: ReceiptDraft): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  if (typeof window === 'undefined') return id
  cleanExpiredDrafts()
  try {
    window.sessionStorage.setItem(
      `${PREFIX}${id}`,
      JSON.stringify({ savedAt: Date.now(), draft } satisfies StoredDraft),
    )
  } catch {
    // Storage can be unavailable (private mode, quota). The form then simply
    // opens without the scanned items instead of failing the whole flow.
  }
  return id
}

export function readReceiptDraft(id: string): ReceiptDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(`${PREFIX}${id}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(`${PREFIX}${id}`)
      return null
    }
    return parsed.draft
  } catch {
    return null
  }
}

export function clearReceiptDraft(id: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(`${PREFIX}${id}`)
  } catch {
    // ignore
  }
}

function cleanExpiredDrafts() {
  try {
    const now = Date.now()
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const raw = window.sessionStorage.getItem(key)
      if (!raw) continue
      try {
        const { savedAt } = JSON.parse(raw) as StoredDraft
        if (now - savedAt > MAX_AGE_MS) window.sessionStorage.removeItem(key)
      } catch {
        window.sessionStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}
