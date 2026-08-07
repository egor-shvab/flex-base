import { describe, expect, it } from 'vitest'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY, UPDATED_AT_KEY } from '#shared/constants/filter'
import { FIELD_TYPES } from '#shared/constants/field'
import { RECORD_COLUMNS } from '~/field-types/record-columns'
import { FIELD_CELLS } from '~/field-types/cells'
import MultiValueCell from '~/field-types/cells/MultiValueCell.vue'
import { cellComponent, cellSingleValue, cellValue, cellValues } from '~/utils/record-cells'
import {
  ALL_TYPE_FIELDS,
  asMultiple,
  record,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'
import { RECORD_NUMBER_FIELD } from '#shared/utils/filter'

/** The record's own columns, as `queryFields` presents them. */
const createdAtColumn = { ...RECORD_NUMBER_FIELD, key: CREATED_AT_KEY, name: 'Created at' }
const updatedAtColumn = { ...RECORD_NUMBER_FIELD, key: UPDATED_AT_KEY, name: 'Updated at' }

describe('cellValue', () => {
  it('reads a table’s own field from the record’s data', () => {
    const row = record({ data: { company: 'Acme' } })

    expect(cellValue(row, textField('company'))).toBe('Acme')
  })

  it('reads the record’s own columns from the record itself', () => {
    const row = record({ number: 42 })

    expect(cellValue(row, RECORD_NUMBER_FIELD)).toBe(42)
    expect(cellValue(row, createdAtColumn)).toBe(row.createdAt)
    expect(cellValue(row, updatedAtColumn)).toBe(row.updatedAt)
  })

  /**
   * Key before type, mirroring the precedence the server's `FIELD_SQL_BY_TYPE` lookup uses.
   * `createField` reserves these keys, so the collision cannot arise today — pinning it is what
   * keeps that true if the lookup is ever reordered.
   */
  it('prefers the record’s own column over a data key of the same name', () => {
    const row = record({ number: 42, data: { [RECORD_NUMBER_KEY]: 'from data' } })

    expect(cellValue(row, RECORD_NUMBER_FIELD)).toBe(42)
  })

  /** Blank is handled once, in `RecordFieldValue` — so an absent key must be null, not undefined. */
  it('answers null for a key the record does not carry', () => {
    expect(cellValue(record(), textField('missing'))).toBeNull()
  })

  it('answers null for a stored null', () => {
    expect(cellValue(record({ data: { company: null } }), textField('company'))).toBeNull()
  })

  it('keeps a stored false and zero rather than falling through', () => {
    expect(cellValue(record({ data: { active: false } }), textField('active'))).toBe(false)
    expect(cellValue(record({ data: { total: 0 } }), textField('total'))).toBe(0)
  })
})

/** Key, then cardinality, then type — asserted as identity, so reordering the branches fails. */
describe('cellComponent', () => {
  it('draws a record’s own column with its own cell', () => {
    expect(cellComponent(RECORD_NUMBER_FIELD)).toBe(RECORD_COLUMNS[RECORD_NUMBER_KEY]?.cell)
    expect(cellComponent(createdAtColumn)).toBe(RECORD_COLUMNS[CREATED_AT_KEY]?.cell)
    expect(cellComponent(updatedAtColumn)).toBe(RECORD_COLUMNS[UPDATED_AT_KEY]?.cell)
  })

  it.each(FIELD_TYPES)('draws a single-value %s with its type’s cell', (type) => {
    expect(cellComponent(ALL_TYPE_FIELDS[type])).toBe(FIELD_CELLS[type])
  })

  /**
   * One shared cell that delegates each entry back to `FIELD_CELLS`, so the registry needs no
   * list variants and a value reads the same alone or in a list.
   */
  it('draws any multi-value field with the one shared list cell', () => {
    expect(cellComponent(asMultiple(selectField()))).toBe(MultiValueCell)
    expect(cellComponent(asMultiple(relationField()))).toBe(MultiValueCell)
  })

  it('ignores multiple on a type that cannot hold several', () => {
    expect(cellComponent(asMultiple(textField()))).toBe(FIELD_CELLS.TEXT)
  })
})

/**
 * The one place a stored value that is not yet an array is accounted for — which is what lets
 * `IMultiValueCellProps.value` be a plain `string[]`.
 */
describe('cellValues', () => {
  it('passes a list through', () => {
    expect(cellValues(['a', 'b'])).toEqual(['a', 'b'])
    expect(cellValues([])).toEqual([])
  })

  it('wraps a bare string from before the field was widened', () => {
    expect(cellValues('a')).toEqual(['a'])
  })

  it('reads anything blank or unrenderable as an empty list', () => {
    expect(cellValues('')).toEqual([])
    expect(cellValues(null)).toEqual([])
    expect(cellValues(42)).toEqual([])
    expect(cellValues(true)).toEqual([])
  })
})

describe('cellSingleValue', () => {
  it('passes a scalar through', () => {
    expect(cellSingleValue('Acme')).toBe('Acme')
    expect(cellSingleValue(42)).toBe(42)
    expect(cellSingleValue(null)).toBeNull()
  })

  /** Neither is blank, and treating them as such is the obvious way to get a cell wrong. */
  it('keeps a false and a zero', () => {
    expect(cellSingleValue(false)).toBe(false)
    expect(cellSingleValue(0)).toBe(0)
  })

  it('takes the first entry of a list, and null from an empty one', () => {
    expect(cellSingleValue(['a', 'b'])).toBe('a')
    expect(cellSingleValue([])).toBeNull()
  })
})
