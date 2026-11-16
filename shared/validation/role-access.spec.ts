import { describe, expect, it } from 'vitest'
import { roleAccessSchema } from '#shared/validation/role-access'
import { buildRecordDefaults } from '~~/test/membership'

const access = (overrides: Record<string, unknown> = {}) => ({
  recordDefaults: buildRecordDefaults(),
  tables: [],
  fields: [],
  ...overrides,
})

describe('roleAccessSchema', () => {
  it('accepts defaults with table and field rows', () => {
    const input = access({
      tables: [{ tableId: 'tbl_deals', ...buildRecordDefaults({ readScope: 'OWN' }) }],
      fields: [{ fieldId: 'fld_salary', access: 'HIDDEN' }],
    })

    expect(roleAccessSchema.parse(input)).toEqual(input)
  })

  it('refuses a table listed twice', () => {
    const row = { tableId: 'tbl_deals', ...buildRecordDefaults() }

    expect(roleAccessSchema.safeParse(access({ tables: [row, row] })).success).toBe(false)
  })

  it('refuses a field listed twice', () => {
    const row = { fieldId: 'fld_salary', access: 'READ' }

    expect(roleAccessSchema.safeParse(access({ fields: [row, row] })).success).toBe(false)
  })

  it('refuses EDIT as a row, which is the absence of one', () => {
    const fields = [{ fieldId: 'fld_salary', access: 'EDIT' }]

    expect(roleAccessSchema.safeParse(access({ fields })).success).toBe(false)
  })

  it('holds a table row to the same rule as the defaults: no action past the read', () => {
    const tables = [
      { tableId: 'tbl_deals', ...buildRecordDefaults({ readScope: 'OWN', updateScope: 'ALL' }) },
    ]

    expect(roleAccessSchema.safeParse(access({ tables })).success).toBe(false)
  })
})
