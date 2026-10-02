import { describe, expect, it } from 'vitest'
import { shouldSearch } from '~/utils/select'

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
