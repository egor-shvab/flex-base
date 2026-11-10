import { describe, expect, it } from 'vitest'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY, UPDATED_AT_KEY } from '#shared/constants/filter'
import { FIELD_TYPES } from '#shared/field-types/registry'
import { RECORD_COLUMNS, cellComponent, readCellValue } from '~/field-types/cell-resolver'
import { FIELD_CELLS, alignFor } from '~/field-types/registry'
import MultiValueCell from '~/field-types/cells/MultiValueCell.vue'
import {
  ALL_TYPE_FIELDS,
  asMultiple,
  createdAtColumn,
  record,
  recordNumberColumn,
  relationField,
  selectField,
  textField,
  updatedAtColumn,
} from '~~/test/fixtures'

describe('readCellValue', () => {
  it('reads a table’s own field from the record’s data', () => {
    const row = record({ data: { company: 'Acme' } })

    expect(readCellValue(row, textField('company'))).toBe('Acme')
  })

  it('reads the record’s own columns from the record itself', () => {
    const row = record({ number: 42 })

    expect(readCellValue(row, recordNumberColumn)).toBe(42)
    expect(readCellValue(row, createdAtColumn)).toBe(row.createdAt)
    expect(readCellValue(row, updatedAtColumn)).toBe(row.updatedAt)
  })

  it('prefers the record’s own column over a data key of the same name', () => {
    const row = record({ number: 42, data: { [RECORD_NUMBER_KEY]: 'from data' } })

    expect(readCellValue(row, recordNumberColumn)).toBe(42)
  })

  it('answers null for a key the record does not carry', () => {
    expect(readCellValue(record(), textField('missing'))).toBeNull()
  })

  it('answers null for a stored null', () => {
    expect(readCellValue(record({ data: { company: null } }), textField('company'))).toBeNull()
  })

  it('keeps a stored false and zero rather than falling through', () => {
    expect(readCellValue(record({ data: { active: false } }), textField('active'))).toBe(false)
    expect(readCellValue(record({ data: { total: 0 } }), textField('total'))).toBe(0)
  })
})

describe('cellComponent', () => {
  it('draws a record’s own column with its own cell', () => {
    expect(cellComponent(recordNumberColumn)).toBe(RECORD_COLUMNS[RECORD_NUMBER_KEY]?.cell)
    expect(cellComponent(createdAtColumn)).toBe(RECORD_COLUMNS[CREATED_AT_KEY]?.cell)
    expect(cellComponent(updatedAtColumn)).toBe(RECORD_COLUMNS[UPDATED_AT_KEY]?.cell)
  })

  it.each(FIELD_TYPES)('draws a single-value %s with its type’s cell', (type) => {
    expect(cellComponent(ALL_TYPE_FIELDS[type])).toBe(FIELD_CELLS[type])
  })

  it('draws any multi-value field with the one shared list cell', () => {
    expect(cellComponent(asMultiple(selectField()))).toBe(MultiValueCell)
    expect(cellComponent(asMultiple(relationField()))).toBe(MultiValueCell)
  })

  it('ignores multiple on a type that cannot hold several', () => {
    expect(cellComponent(asMultiple(textField()))).toBe(FIELD_CELLS.TEXT)
  })
})

describe('alignFor', () => {
  it('puts only NUMBER against the end', () => {
    const ends = FIELD_TYPES.filter((type) => alignFor(ALL_TYPE_FIELDS[type]) === 'end')

    expect(ends).toEqual(['NUMBER'])
  })

  it('leaves the record’s own columns at the start', () => {
    for (const column of [recordNumberColumn, createdAtColumn, updatedAtColumn]) {
      expect(alignFor(column)).toBe('start')
    }
  })
})
