import { describe, expect, it } from 'vitest'
import { singleParam } from '#shared/utils/query-param'

describe('singleParam', () => {
  it('reads a single non-empty string', () => {
    expect(singleParam('acme')).toBe('acme')
  })

  it('takes the first value of a repeated param', () => {
    expect(singleParam(['first', 'second'])).toBe('first')
  })

  it('stringifies a number, which is how a router may hand a numeric param over', () => {
    expect(singleParam(42)).toBe('42')
    expect(singleParam(0)).toBe('0')
  })

  it('collapses an empty param, an absent one and an empty repeat to undefined', () => {
    expect(singleParam('')).toBeUndefined()
    expect(singleParam(undefined)).toBeUndefined()
    expect(singleParam(null)).toBeUndefined()
    expect(singleParam([])).toBeUndefined()
    expect(singleParam([''])).toBeUndefined()
  })

  it('rejects a non-string first value', () => {
    expect(singleParam({ nested: true })).toBeUndefined()
    expect(singleParam([{ nested: true }])).toBeUndefined()
  })
})
