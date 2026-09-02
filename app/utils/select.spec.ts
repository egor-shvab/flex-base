import { describe, expect, it } from 'vitest'
import { shouldSearch } from '~/utils/select'

/**
 * The threshold constant is private on purpose, so what is pinned here is the comparison —
 * "more than eight", not the eight itself. Moving the number is a design decision; changing
 * `>` to `>=` under it is a bug.
 */
describe('shouldSearch', () => {
  it('leaves a short picker unsearchable', () => {
    expect(shouldSearch(0)).toBe(false)
    expect(shouldSearch(1)).toBe(false)
    expect(shouldSearch(3)).toBe(false)
  })

  it('is exclusive at the boundary', () => {
    expect(shouldSearch(8)).toBe(false)
    expect(shouldSearch(9)).toBe(true)
  })

  it('searches a long list', () => {
    expect(shouldSearch(100)).toBe(true)
  })
})
