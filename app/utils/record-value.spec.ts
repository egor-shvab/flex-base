import { describe, expect, it } from 'vitest'
import { toValueList } from '~/utils/record-value'

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
