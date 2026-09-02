/**
 * The app's display formatters, in one place so the cells and the filter summary can
 * never drift apart.
 *
 * Every locale is hard-coded to `en-GB` and never left `undefined`: the server and the
 * browser would otherwise pick different locales and the render would not match on
 * hydration. For the same reason `TIMESTAMP_FORMAT` pins `timeZone: 'UTC'`.
 */

/** `1,284` — thousands separated, for counts and NUMBER cells. */
const NUMBER_FORMAT = new Intl.NumberFormat('en-GB')

/** `01 Jan 2026` — compact, for a DATE cell in a table row. */
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/**
 * `1 Jan 2026` — the same day, phrased for prose rather than a column. Two named
 * constants rather than one formatter reconfigured per call, so neither can drift.
 */
const DATE_PROSE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** `01 Jan 2026, 09:14` in UTC — see the note on hydration above. */
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value)
}

/**
 * Parses a date-only `YYYY-MM-DD` as local midnight, so the displayed day never shifts
 * across time zones. An unparseable value is returned as-is rather than rendered as
 * "Invalid Date".
 */
function parseDateOnly(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string): string {
  const date = parseDateOnly(value)
  return date ? DATE_FORMAT.format(date) : value
}

export function formatDateProse(value: string): string {
  const date = parseDateOnly(value)
  return date ? DATE_PROSE_FORMAT.format(date) : value
}

export function formatTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : TIMESTAMP_FORMAT.format(date)
}

/**
 * How many records a narrowed list is showing — the filter drawer's footer and the summary
 * line above the table both state it.
 *
 * Deliberately **not** through `formatNumber`: the count is unseparated (`1284 matching
 * records`), and routing it through the thousands formatter would change user-visible copy.
 */
export function formatMatchingRecords(total: number, capped = false): string {
  // Past the cap the count is a floor, so it is stated as one
  if (capped) return `${total}+ matching records`

  return `${total} matching ${total === 1 ? 'record' : 'records'}`
}
