import { describe, expect, it } from 'vitest'
import { toInitials } from '~/utils/initials'

describe('toInitials', () => {
  it('takes one letter from a single-word name', () => {
    expect(toInitials('test')).toBe('T')
  })

  it('takes the first letter of each of two words', () => {
    expect(toInitials('Ada Lovelace')).toBe('AL')
  })

  it('reads a name backfilled from an email local part the same way', () => {
    expect(toInitials('ada.lovelace')).toBe('AL')
  })

  it('splits on whitespace, dots, underscores and hyphens, and stops at two', () => {
    expect(toInitials('a_b-c d')).toBe('AB')
  })

  it('keeps non-Latin letters', () => {
    expect(toInitials('Ирина Петрова')).toBe('ИП')
  })

  it('falls back to a question mark when there is nothing to read', () => {
    expect(toInitials('')).toBe('?')
    expect(toInitials('  ')).toBe('?')
  })
})
