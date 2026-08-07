import { describe, expect, it } from 'vitest'
import { DEFAULT_BADGE_COLOR } from '#shared/constants/color'
import { FIELD_TYPES, MULTI_VALUE_BY_TYPE } from '#shared/constants/field'
import { badgeColorFor, choiceOptions, choiceValues, isMultiValue } from '#shared/utils/field'
import {
  ALL_TYPE_FIELDS,
  asMultiple,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

describe('isMultiValue', () => {
  it('is false without options', () => {
    expect(isMultiValue(textField())).toBe(false)
  })

  it('honours `multiple` only on the types the registry allows', () => {
    for (const type of FIELD_TYPES) {
      expect(isMultiValue(asMultiple(ALL_TYPE_FIELDS[type]))).toBe(MULTI_VALUE_BY_TYPE[type])
    }
  })

  it('ignores a crafted `multiple` on a type with no list form', () => {
    // The guard that stops a stale or hand-written flag reaching the schema or the SQL
    expect(isMultiValue(asMultiple(textField()))).toBe(false)
  })

  it('treats anything but `true` as single-value', () => {
    const stale = { ...selectField(), options: { multiple: undefined } }
    expect(isMultiValue(stale)).toBe(false)
  })
})

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
