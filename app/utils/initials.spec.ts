import { describe, expect, it } from 'vitest'
import { toInitials } from '~/utils/initials'

describe('toInitials', () => {
  it('takes one letter from a single-word name', () => {
    expect(toInitials('test@test.com')).toBe('T')
  })

  it('takes the first letter of each of two parts', () => {
    expect(toInitials('ada.lovelace@example.io')).toBe('AL')
  })

  it('splits on dots, underscores and hyphens, and stops at two', () => {
    expect(toInitials('a_b-c@example.io')).toBe('AB')
  })

  it('ignores the domain', () => {
    expect(toInitials('x@acme.co')).toBe('X')
  })

  it('falls back to a question mark when there is nothing to read', () => {
    expect(toInitials('')).toBe('?')
  })
})
