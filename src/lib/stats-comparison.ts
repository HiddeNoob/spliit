/**
 * Period-over-period comparison helpers for the stats page.
 *
 * Everything works in minor units and on `YYYY-MM-DD` date strings, matching
 * the rest of the stats pipeline. The functions are pure so the same numbers
 * are used by the page and by the CSV export.
 */

export type TotalComparison = {
  current: number
  previous: number
  /** Percentage change, rounded to one decimal. Null when the previous period was empty. */
  changePercent: number | null
  direction: 'up' | 'down' | 'flat'
}

export function compareTotals(
  current: number,
  previous: number,
): TotalComparison {
  const difference = current - previous
  return {
    current,
    previous,
    changePercent:
      previous === 0 ? null : Math.round((difference / previous) * 1000) / 10,
    direction: difference === 0 ? 'flat' : difference > 0 ? 'up' : 'down',
  }
}

/** Adds days to a `YYYY-MM-DD` string, staying timezone-safe (UTC). */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day))
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

/**
 * Returns the range immediately before `[from, to]`, with the same inclusive
 * length. Returns null for an unbounded ("all time") range, where there is no
 * meaningful previous period.
 *
 * For the unbounded case callers compare the last 30 days with the 30 days
 * before that, see {@link getComparisonRanges}.
 */
export function getPreviousRange(
  from?: string,
  to?: string,
): { from: string; to: string } | null {
  if (!from || !to) return null
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return null
  }
  const lengthInDays = Math.round((end - start) / 86_400_000) + 1
  const previousTo = addDays(from, -1)
  const previousFrom = addDays(previousTo, -(lengthInDays - 1))
  return { from: previousFrom, to: previousTo }
}

/**
 * Resolves the current and previous comparison ranges. When the page has no
 * date filter, the current range is the last 30 days and the previous range is
 * the 30 days before them, which keeps the comparison useful instead of hiding
 * the card for most users.
 */
export function getComparisonRanges(
  from?: string,
  to?: string,
  now = new Date(),
): {
  current: { from: string; to: string }
  previous: { from: string; to: string }
} {
  const today = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('-')

  const currentFrom = from ?? addDays(today, -29)
  const currentTo = to ?? today
  const previous = getPreviousRange(currentFrom, currentTo) ?? {
    from: addDays(currentFrom, -30),
    to: addDays(currentFrom, -1),
  }

  return {
    current: { from: currentFrom, to: currentTo },
    previous,
  }
}
