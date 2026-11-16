import { describe, expect, it } from 'vitest'
import { FULL_TABLE_ACCESS, WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  IAccessTable,
  IRoleGrants,
  ITableAccess,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { isAccessWithin, type IAccessHolder } from '#shared/utils/role-access'
import { buildRecordDefaults } from '~~/test/membership'

const deals: IAccessTable = {
  id: 'tbl_deals',
  name: 'Deals',
  fields: [
    { id: 'fld_company', name: 'Company', type: 'TEXT', required: false },
    { id: 'fld_salary', name: 'Salary', type: 'NUMBER', required: false },
  ],
}
const tables = [deals]

const grants = (
  permissions: TWorkspacePermission[] = [],
  defaults: Partial<ITableAccess> = {},
  overrides: Partial<Pick<IRoleGrants, 'tables' | 'fields'>> = {},
): IRoleGrants => ({
  permissions,
  recordDefaults: buildRecordDefaults(defaults),
  tables: [],
  fields: [],
  ...overrides,
})

/** A manager who may handle members and roles, and add and edit records — but not delete them. */
const managerDefaults = { canCreate: true, updateScope: 'ALL' } as const
const manager: IAccessHolder = {
  isOwner: false,
  ...grants(['MEMBERS_MANAGE', 'ROLES_MANAGE'], managerDefaults),
}

const owner: IAccessHolder = { isOwner: true, ...grants() }

const everything = grants([...WORKSPACE_PERMISSIONS], FULL_TABLE_ACCESS)

describe('isAccessWithin — permissions and defaults', () => {
  it.each([
    ['a subset of their own', grants(['MEMBERS_MANAGE'], { canCreate: true }), true],
    ['exactly their own', grants(['MEMBERS_MANAGE', 'ROLES_MANAGE'], managerDefaults), true],
    ['nothing at all', grants(), true],
    ['one permission more', grants(['TABLES_MANAGE']), false],
    ['one record action more', grants([], { deleteScope: 'ALL' }), false],
  ])('a role holding %s: %s', (_, subject, expected) => {
    expect(isAccessWithin(subject, manager, tables)).toBe(expected)
  })

  it('holds every role within the owner', () => {
    expect(isAccessWithin(everything, owner, tables)).toBe(true)
  })

  it('compares the defaults even with no table yet, since every future table takes them', () => {
    expect(isAccessWithin(grants([], { deleteScope: 'ALL' }), manager, [])).toBe(false)
  })
})

describe('isAccessWithin — table by table', () => {
  it('refuses a role reading all of a table the holder reads only their own of', () => {
    const holder: IAccessHolder = {
      ...manager,
      tables: [{ tableId: deals.id, ...buildRecordDefaults({ readScope: 'OWN' }) }],
    }

    expect(isAccessWithin(grants(), holder, tables)).toBe(false)
    expect(isAccessWithin(grants([], { readScope: 'OWN' }), holder, tables)).toBe(true)
  })

  it('refuses a table row wider than the holder’s access there', () => {
    const subject = grants([], {}, { tables: [{ tableId: deals.id, ...FULL_TABLE_ACCESS }] })

    expect(isAccessWithin(subject, manager, tables)).toBe(false)
  })

  it('lets a role see a table hidden from the holder only if the holder manages tables', () => {
    const hidden = [{ tableId: deals.id, ...buildRecordDefaults({ readScope: 'NONE' }) }]
    const holder: IAccessHolder = { ...manager, tables: hidden }

    expect(isAccessWithin(grants(), holder, tables)).toBe(false)
    expect(isAccessWithin(grants([], {}, { tables: hidden }), holder, tables)).toBe(true)
  })
})

describe('isAccessWithin — field by field', () => {
  const salaryHidden = [{ fieldId: 'fld_salary', access: 'HIDDEN' as const }]

  it('refuses a role seeing a field hidden from the holder', () => {
    const holder: IAccessHolder = { ...manager, fields: salaryHidden }

    expect(isAccessWithin(grants(), holder, tables)).toBe(false)
    expect(isAccessWithin(grants([], {}, { fields: salaryHidden }), holder, tables)).toBe(true)
  })

  it('refuses a role editing a field the holder may only read', () => {
    const holder: IAccessHolder = {
      ...manager,
      fields: [{ fieldId: 'fld_salary', access: 'READ' }],
    }

    expect(isAccessWithin(grants([], { canCreate: true }), holder, tables)).toBe(false)
    expect(isAccessWithin(grants(), holder, tables)).toBe(true)
  })

  it('ignores the fields of a table the role does not read at all', () => {
    const holder: IAccessHolder = { ...manager, fields: salaryHidden }
    const subject = grants(
      [],
      {},
      {
        tables: [{ tableId: deals.id, ...buildRecordDefaults({ readScope: 'NONE' }) }],
      },
    )

    expect(isAccessWithin(subject, holder, tables)).toBe(true)
  })

  it('lets a holder who manages tables grant every field, as they see every one', () => {
    const schemaManager: IAccessHolder = {
      isOwner: false,
      ...grants(['TABLES_MANAGE'], managerDefaults, { fields: salaryHidden }),
    }

    expect(isAccessWithin(grants([], managerDefaults), schemaManager, tables)).toBe(true)
  })
})
