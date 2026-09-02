import { describe, expect, it } from 'vitest'
import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import { badgeColorFor, choiceOptions, choiceValues } from '#shared/field-types/select'
import { relationField, selectField, textField } from '~~/test/fixtures'

describe('choiceValues', () => {
  it('unwraps a SELECT to bare strings', () => {
    expect(choiceValues(selectField(['Won', 'Lost']))).toEqual(['Won', 'Lost'])
  })

  it('is empty for a field with no choices', () => {
    expect(choiceValues(textField())).toEqual([])
  })
})

describe('choiceOptions', () => {
  it('uses the choice value as its own label and keeps the colour', () => {
    expect(choiceOptions(selectField([{ value: 'Won', color: 'green' }]))).toEqual([
      { value: 'Won', label: 'Won', color: 'green' },
    ])
  })

  it('is empty for a field whose options carry no choices at all', () => {
    expect(choiceOptions(relationField())).toEqual([])
    expect(choiceOptions(textField())).toEqual([])
  })
})

describe('badgeColorFor', () => {
  it('reads the configured colour', () => {
    expect(badgeColorFor(selectField([{ value: 'Won', color: 'green' }]), 'Won')).toBe('green')
  })

  it('falls back to the default for a value the field no longer offers', () => {
    // A choice renamed after records were written — the stale cell still shows its text
    expect(badgeColorFor(selectField(['Won']), 'Renamed')).toBe(DEFAULT_BADGE_COLOR)
  })

  it('falls back for a field with no choices at all', () => {
    expect(badgeColorFor(textField(), 'anything')).toBe(DEFAULT_BADGE_COLOR)
  })
})
