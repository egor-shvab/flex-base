import { describe, expect, it } from 'vitest'
import type { IField } from '#shared/types/field'
import { FIELD_CONFIG_SUMMARIES } from '~/field-types/registry'
import type { IFieldConfigSummaryContext } from '~/field-types/types'
import {
  booleanField,
  dateField,
  field,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

const TABLE_NAMES: Record<string, string> = { tbl_people: 'People' }

const ctx: IFieldConfigSummaryContext = { tableName: (tableId) => TABLE_NAMES[tableId] }

const emptyCtx: IFieldConfigSummaryContext = { tableName: () => undefined }

function summarise(field: IField, context = ctx): string {
  const entry = FIELD_CONFIG_SUMMARIES[field.type]
  if (entry === null) throw new Error(`${field.type} declares no config summary`)

  return entry(field, context)
}

describe('SELECT', () => {
  it('counts the choices', () => {
    expect(summarise(selectField(['Won', 'Lost']))).toBe('2 choices')
  })

  it('says one choice in the singular', () => {
    expect(summarise(selectField(['Won']))).toBe('1 choice')
  })

  it('counts 0 for a field with no choices yet', () => {
    expect(summarise(selectField([]))).toBe('0 choices')
  })

  it('counts 0 rather than throwing when the options are missing entirely', () => {
    expect(summarise(field({ key: 'stage', type: 'SELECT', options: null }))).toBe('0 choices')
  })
})

describe('RELATION', () => {
  it('names the target table', () => {
    expect(summarise(relationField())).toBe('links to People')
  })

  it('falls back to a phrase when the store holds no row for the target', () => {
    expect(summarise(relationField(), emptyCtx)).toBe('links to another table')
  })

  it('falls back the same way when the field names no target at all', () => {
    expect(summarise(relationField({ targetTableId: undefined }))).toBe('links to another table')
  })
})

describe('the types that configure nothing', () => {
  it.each([
    ['TEXT', textField()],
    ['NUMBER', numberField()],
    ['BOOLEAN', booleanField()],
    ['DATE', dateField()],
  ])('%s declares no config summary', (_label, field) => {
    expect(FIELD_CONFIG_SUMMARIES[field.type]).toBeNull()
  })
})
