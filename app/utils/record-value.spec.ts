import { describe, expect, it } from 'vitest'
import { toCellSingleValue, toValueList } from '~/utils/record-value'

/**
 * The one place a stored value that is not yet an array is accounted for — which is what lets
 * `IMultiValueCellProps.value` be a plain `string[]`, and what stops a form dropping a value it
 * is about to save back.
 *
 * A plain `*.spec.ts` rather than `*.nuxt.spec.ts`: the module imports no `.vue` file and needs
 * no Nuxt runtime, so it belongs in the fast project (`CLAUDE.md` §10).
 */
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

  /** A range is neither a value nor a list of them, and must not decode as one. */
  it('reads a range as an empty list', () => {
    expect(toValueList({ from: 1, to: 2 })).toEqual([])
  })
})

/**
 * The single-value counterpart. Pure like `toValueList`, and here rather than beside
 * `cellComponent` for the same reason: resolving *which* cell draws a column reads the registries
 * and needs the Nuxt project; deciding what one value looks like does not.
 */
describe('toCellSingleValue', () => {
  it('passes a scalar through', () => {
    expect(toCellSingleValue('Acme')).toBe('Acme')
    expect(toCellSingleValue(42)).toBe(42)
    expect(toCellSingleValue(null)).toBeNull()
  })

  /** Neither is blank, and treating them as such is the obvious way to get a cell wrong. */
  it('keeps a false and a zero', () => {
    expect(toCellSingleValue(false)).toBe(false)
    expect(toCellSingleValue(0)).toBe(0)
  })

  it('takes the first entry of a list, and null from an empty one', () => {
    expect(toCellSingleValue(['a', 'b'])).toBe('a')
    expect(toCellSingleValue([])).toBeNull()
  })
})
