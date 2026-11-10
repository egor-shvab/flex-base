import { describe, expect, it } from 'vitest'
import { parseAddressNumber, parseTableAddress, toTableAddress } from '#shared/utils/address'

describe('parseAddressNumber', () => {
  it('reads a plain number', () => {
    expect(parseAddressNumber('12')).toBe(12)
    expect(parseAddressNumber('1')).toBe(1)
  })

  it('accepts leading zeroes', () => {
    expect(parseAddressNumber('012')).toBe(12)
  })

  it.each([
    ['zero, which no row holds', '0'],
    ['a negative', '-1'],
    ['a decimal', '1.5'],
    ['exponent notation', '1e3'],
    ['a plain word', 'abc'],
    ['nothing at all', ''],
    ['whitespace', ' 12 '],
    ['digits with a suffix', '12abc'],
    ['a slug, which only a table address carries', '12-deals'],
  ])('is 0 for %s', (_case, raw) => {
    expect(parseAddressNumber(raw)).toBe(0)
  })

  it('is 0 past a PostgreSQL Int, and accepts the largest one', () => {
    expect(parseAddressNumber('2147483647')).toBe(2147483647)
    expect(parseAddressNumber('2147483648')).toBe(0)
    expect(parseAddressNumber('9'.repeat(40))).toBe(0)
  })
})

describe('parseTableAddress', () => {
  it('reads the number whether or not a slug follows it', () => {
    expect(parseTableAddress('12')).toBe(12)
    expect(parseTableAddress('12-deals')).toBe(12)
  })

  it('ignores what the slug says, however wrong it is', () => {
    expect(parseTableAddress('12-something-else-entirely')).toBe(12)
    expect(parseTableAddress('12-')).toBe(12)
  })

  it.each([
    ['a cuid, which is what a pre-migration bookmark carries', 'cmsesqhp60003bgtl7g0dn583'],
    ['a slug with no number', 'deals'],
    ['a leading separator', '-12'],
    ['digits with an unseparated suffix', '12abc'],
    ['nothing at all', ''],
  ])('is 0 for %s', (_case, raw) => {
    expect(parseTableAddress(raw)).toBe(0)
  })
})

describe('toTableAddress', () => {
  it('round-trips through the parser', () => {
    expect(parseTableAddress(toTableAddress({ number: 12 }))).toBe(12)
  })
})
