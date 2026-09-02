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

/** The store holding nothing at all — `ensureTables` never throws, so this is a real state. */
const emptyCtx: IFieldConfigSummaryContext = { tableName: () => undefined }

/**
 * How one field's configuration reads beside its type. Indexed directly rather than through a
 * resolver, because cardinality is not this map's business — `isMultiValue` answers that.
 */
function summarise(field: IField, context = ctx): string {
  const entry = FIELD_CONFIG_SUMMARIES[field.type]
  if (entry === null) throw new Error(`${field.type} declares no config summary`)

  return entry(field, context)
}

describe('SELECT', () => {
  it('counts the choices', () => {
    expect(summarise(selectField(['Won', 'Lost']))).toBe('2 choices')
  })

  /** The singular is the whole reason this is a function rather than a length in a template. */
  it('says one choice in the singular', () => {
    expect(summarise(selectField(['Won']))).toBe('1 choice')
  })

  it('counts 0 for a field with no choices yet', () => {
    expect(summarise(selectField([]))).toBe('0 choices')
  })

  /** Built from the base fixture, since `selectField` always writes an options object. */
  it('counts 0 rather than throwing when the options are missing entirely', () => {
    expect(summarise(field({ key: 'stage', type: 'SELECT', options: null }))).toBe('0 choices')
  })
})

describe('RELATION', () => {
  it('names the target table', () => {
    expect(summarise(relationField())).toBe('links to People')
  })

  /**
   * Never blank: the caller has already drawn the separator in front of this by the time an
   * unloaded store is known, so an empty string would leave it dangling.
   */
  it('falls back to a phrase when the store holds no row for the target', () => {
    expect(summarise(relationField(), emptyCtx)).toBe('links to another table')
  })

  it('falls back the same way when the field names no target at all', () => {
    expect(summarise(relationField({ targetTableId: undefined }))).toBe('links to another table')
  })
})

/**
 * `null` here means "fully described by its own word", not "no list form" — and it is what
 * leaves the separator undrawn. An entry returning `''` to be helpful would draw one.
 */
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
