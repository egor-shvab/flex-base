import { describe, expect, it } from 'vitest'
import { optionValuesKey } from '~/components/common/BaseSelect/option-values-key'
import type { ISelectOption } from '~/types/select'

const option = (value: string): ISelectOption => ({ value, label: value })

describe('optionValuesKey', () => {
  it('keys a rebuilt array of the same values identically', () => {
    expect(optionValuesKey([option('a'), option('b')])).toBe(
      optionValuesKey([option('a'), option('b')]),
    )
  })

  it('keys a different set differently', () => {
    expect(optionValuesKey([option('a')])).not.toBe(optionValuesKey([option('a'), option('b')]))
    expect(optionValuesKey([])).not.toBe(optionValuesKey([option('a')]))
  })

  /** Order is what the cursor indexes into, so a reordered list is a changed list. */
  it('keys a reordered list differently', () => {
    expect(optionValuesKey([option('a'), option('b')])).not.toBe(
      optionValuesKey([option('b'), option('a')]),
    )
  })

  /**
   * Why this is not a `join`. A SELECT choice is free text, so any separator can appear inside a
   * value — with one, `['a,b']` and `['a', 'b']` would key the same and the watcher would stop
   * firing for a list that had genuinely changed.
   */
  it('keys a value containing a separator apart from two values', () => {
    expect(optionValuesKey([option('a,b')])).not.toBe(optionValuesKey([option('a'), option('b')]))
    expect(optionValuesKey([option('a"b')])).not.toBe(optionValuesKey([option('a'), option('b')]))
  })

  /** The label is not part of the key: only which values are on offer decides a change. */
  it('ignores everything but the value', () => {
    expect(optionValuesKey([{ value: 'a', label: 'Alpha' }])).toBe(
      optionValuesKey([{ value: 'a', label: 'Omega', color: 'blue' }]),
    )
  })
})
