import { describe, expect, it } from 'vitest'
import { toCellSingleValue, toValueList } from '~/utils/value-shape'

describe('toValueList', () => {
  it('passes a list through', () => {
    expect(toValueList(['a', 'b'])).toEqual(['a', 'b'])
    expect(toValueList([])).toEqual([])
  })

  it('wraps a bare string from before the field was widened', () => {
    expect(toValueList('a')).toEqual(['a'])
  })

  it('reads anything blank or unrenderable as an empty list', () => {
    expect(toValueList('')).toEqual([])
    expect(toValueList(null)).toEqual([])
    expect(toValueList(42)).toEqual([])
    expect(toValueList(true)).toEqual([])
  })

  it('reads a range as an empty list', () => {
    expect(toValueList({ from: 1, to: 2 })).toEqual([])
  })
})

describe('toCellSingleValue', () => {
  it('passes a scalar through', () => {
    expect(toCellSingleValue('Acme')).toBe('Acme')
    expect(toCellSingleValue(42)).toBe(42)
    expect(toCellSingleValue(null)).toBeNull()
  })

  it('keeps a false and a zero', () => {
    expect(toCellSingleValue(false)).toBe(false)
    expect(toCellSingleValue(0)).toBe(0)
  })

  it('takes the first entry of a list, and null from an empty one', () => {
    expect(toCellSingleValue(['a', 'b'])).toBe('a')
    expect(toCellSingleValue([])).toBeNull()
  })
})
