import { describe, expect, it } from 'vitest'
import {
  formatCount,
  formatDate,
  formatDateProse,
  formatMatchingRecords,
  formatNumber,
  formatTimestamp,
} from '~/utils/format'

/** ICU has moved en-GB's separators between versions; any whitespace folds to a space. */
function spaces(value: string): string {
  return value.replace(/\s/g, ' ')
}

describe('formatCount', () => {
  it('uses the singular for exactly one', () => {
    expect(formatCount(1, 'table')).toBe('1 table')
  })

  it('uses the plural for none and for many', () => {
    expect(formatCount(0, 'table')).toBe('0 tables')
    expect(formatCount(6, 'table')).toBe('6 tables')
  })

  it('separates thousands in the count', () => {
    expect(spaces(formatCount(2009, 'record'))).toBe('2,009 records')
  })
})

describe('formatNumber', () => {
  it('separates thousands', () => {
    expect(spaces(formatNumber(1284))).toBe('1,284')
    expect(spaces(formatNumber(1234567))).toBe('1,234,567')
  })

  it('leaves a value under a thousand alone', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(42)).toBe('42')
  })

  it('keeps the sign and the decimal part', () => {
    expect(spaces(formatNumber(-1234.5))).toBe('-1,234.5')
  })
})

describe('formatDate and formatDateProse', () => {
  it('pad the day for a column and do not for prose', () => {
    expect(spaces(formatDate('2026-01-05'))).toBe('05 Jan 2026')
    expect(spaces(formatDateProse('2026-01-05'))).toBe('5 Jan 2026')
  })

  it('agree on a two-digit day, where padding makes no difference', () => {
    expect(spaces(formatDate('2026-12-25'))).toBe('25 Dec 2026')
    expect(spaces(formatDateProse('2026-12-25'))).toBe('25 Dec 2026')
  })

  it('return an unparseable value unchanged', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
    expect(formatDateProse('not-a-date')).toBe('not-a-date')
    expect(formatDate('')).toBe('')
  })
})

describe('formatTimestamp', () => {
  it('writes the date and a 24-hour time', () => {
    expect(spaces(formatTimestamp('2026-08-07T03:52:10.000Z'))).toBe('07 Aug 2026, 03:52')
  })

  it('is pinned to UTC rather than to the host time zone', () => {
    expect(spaces(formatTimestamp('2026-01-01T00:00:00.000Z'))).toBe('01 Jan 2026, 00:00')
    expect(spaces(formatTimestamp('2026-01-01T23:59:00.000Z'))).toBe('01 Jan 2026, 23:59')
  })

  it('does not roll the day over at noon, the way a 12-hour clock would', () => {
    expect(spaces(formatTimestamp('2026-06-15T12:00:00.000Z'))).toBe('15 Jun 2026, 12:00')
    expect(spaces(formatTimestamp('2026-06-15T00:30:00.000Z'))).toBe('15 Jun 2026, 00:30')
  })

  it('returns an unparseable value unchanged', () => {
    expect(formatTimestamp('whenever')).toBe('whenever')
  })
})

describe('formatMatchingRecords', () => {
  it('singularises exactly one match', () => {
    expect(formatMatchingRecords(1)).toBe('1 matching record')
  })

  it('pluralises none and many alike', () => {
    expect(formatMatchingRecords(0)).toBe('0 matching records')
    expect(formatMatchingRecords(12)).toBe('12 matching records')
  })

  it('leaves a large count unseparated', () => {
    expect(formatMatchingRecords(1284)).toBe('1284 matching records')
  })
})
