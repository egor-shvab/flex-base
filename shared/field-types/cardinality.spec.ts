import { describe, expect, it } from 'vitest'
import { isMultiValue } from '#shared/field-types/cardinality'
import { FIELD_TYPES, MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
import { ALL_TYPE_FIELDS, asMultiple, selectField, textField } from '~~/test/fixtures'

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
