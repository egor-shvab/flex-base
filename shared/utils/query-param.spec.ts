import { describe, expect, it } from 'vitest'
import { parseSingleParam } from '#shared/utils/query-param'

describe('parseSingleParam', () => {
  it('reads a single non-empty string', () => {
    expect(parseSingleParam('acme')).toBe('acme')
  })

  it('takes the first value of a repeated param', () => {
    expect(parseSingleParam(['first', 'second'])).toBe('first')
  })

  it('stringifies a number, which is how a router may hand a numeric param over', () => {
    expect(parseSingleParam(42)).toBe('42')
    expect(parseSingleParam(0)).toBe('0')
  })

  it('collapses an empty param, an absent one and an empty repeat to undefined', () => {
    expect(parseSingleParam('')).toBeUndefined()
    expect(parseSingleParam(undefined)).toBeUndefined()
    expect(parseSingleParam(null)).toBeUndefined()
    expect(parseSingleParam([])).toBeUndefined()
    expect(parseSingleParam([''])).toBeUndefined()
  })

  it('rejects a non-string first value', () => {
    expect(parseSingleParam({ nested: true })).toBeUndefined()
    expect(parseSingleParam([{ nested: true }])).toBeUndefined()
  })
})
