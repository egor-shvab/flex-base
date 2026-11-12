/**
 * Display formatters. Locale and time zone are pinned, or server and browser render differently
 * and hydration mismatches.
 */

const NUMBER_FORMAT = new Intl.NumberFormat('en-GB')

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const DATE_PROSE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const TIMESTAMP_DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

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

export function formatCount(count: number, noun: string): string {
  return `${formatNumber(count)} ${count === 1 ? noun : `${noun}s`}`
}

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

/** The day of a moment, where the time would be noise: when someone joined, when it expires. */
export function formatTimestampDay(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : TIMESTAMP_DAY_FORMAT.format(date)
}

export function formatMatchingRecords(total: number, isCapped = false): string {
  if (isCapped) return `${total}+ matching records`

  return `${total} matching ${total === 1 ? 'record' : 'records'}`
}
