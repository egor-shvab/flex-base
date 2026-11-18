import { describe, expect, it } from 'vitest'
import {
  applyFieldAccess,
  applyTableOverride,
  buildAccessLimits,
  findFieldAccess,
  findTableOverride,
  isRoleVisibilityBypassed,
  resolveSubjectTableAccess,
  summariseFieldAccess,
  toRolePayload,
} from '~/utils/role-form'
import { FULL_TABLE_ACCESS, NO_TABLE_ACCESS } from '#shared/constants/workspace'
import type { IAccessTable } from '#shared/types/workspace'
import type { TRoleInput } from '#shared/validation/workspace'
import { buildMembership, buildTableAccess, buildRoleInput } from '~~/test/membership'

const DEALS: IAccessTable = {
  id: 'tbl_deals',
  name: 'Deals',
  fields: [
    { id: 'fld_company', name: 'Company', type: 'TEXT', required: true },
    { id: 'fld_salary', name: 'Salary', type: 'NUMBER', required: false },
    { id: 'fld_notes', name: 'Notes', type: 'TEXT', required: false },
  ],
}

const role = (overrides: Partial<TRoleInput> = {}): TRoleInput => ({
  ...buildRoleInput('Clerk', [], [{ tableId: DEALS.id, ...buildTableAccess({ canCreate: true }) }]),
  ...overrides,
})

const ownOnly = buildTableAccess({ readScope: 'OWN' })

describe('a table’s row', () => {
  it('is set and replaced, and dropped once it grants nothing', () => {
    const set = applyTableOverride([], DEALS.id, ownOnly)
    expect(findTableOverride(set, DEALS.id)).toEqual(ownOnly)

    const replaced = applyTableOverride(set, DEALS.id, FULL_TABLE_ACCESS)
    expect(replaced).toEqual([{ tableId: DEALS.id, ...FULL_TABLE_ACCESS }])

    expect(applyTableOverride(replaced, DEALS.id, NO_TABLE_ACCESS)).toEqual([])
  })

  it('decides the role’s access to the table, nothing without one', () => {
    expect(resolveSubjectTableAccess(role(), DEALS.id).canCreate).toBe(true)
    expect(resolveSubjectTableAccess(role(), 'tbl_other')).toEqual(NO_TABLE_ACCESS)

    const narrowed = role({ tables: applyTableOverride([], DEALS.id, ownOnly) })
    expect(resolveSubjectTableAccess(narrowed, DEALS.id)).toEqual(ownOnly)
  })
})

describe('a field’s access', () => {
  it('is editable without a row, and a row narrows it', () => {
    expect(findFieldAccess([], 'fld_salary')).toBe('EDIT')

    const hidden = applyFieldAccess([], 'fld_salary', 'HIDDEN')
    expect(hidden).toEqual([{ fieldId: 'fld_salary', access: 'HIDDEN' }])
    expect(findFieldAccess(hidden, 'fld_salary')).toBe('HIDDEN')
  })

  it('drops its row when set back to editable', () => {
    const hidden = applyFieldAccess([], 'fld_salary', 'HIDDEN')

    expect(applyFieldAccess(hidden, 'fld_salary', 'EDIT')).toEqual([])
  })
})

describe('summariseFieldAccess', () => {
  it('counts the fields, and says so when the role narrows none', () => {
    expect(summariseFieldAccess(DEALS, [])).toBe('3 fields · all editable')
  })

  it('counts the hidden and read-only fields of this table only', () => {
    const rows = [
      { fieldId: 'fld_salary', access: 'HIDDEN' as const },
      { fieldId: 'fld_notes', access: 'READ' as const },
      { fieldId: 'fld_elsewhere', access: 'HIDDEN' as const },
    ]

    expect(summariseFieldAccess(DEALS, rows)).toBe('3 fields · 1 hidden · 1 read only')
  })

  it('says “field” for one', () => {
    expect(summariseFieldAccess({ ...DEALS, fields: DEALS.fields.slice(0, 1) }, [])).toBe(
      '1 field · all editable',
    )
  })
})

describe('toRolePayload', () => {
  const hidden = [{ fieldId: 'fld_salary', access: 'HIDDEN' as const }]

  it('keeps the field rows of a table the role reads', () => {
    expect(toRolePayload(role({ fields: hidden }), [DEALS]).fields).toEqual(hidden)
  })

  it('drops the field rows of a table the role no longer reads, which the server would refuse', () => {
    const closed = role({
      fields: hidden,
      tables: [{ tableId: DEALS.id, ...buildTableAccess({ readScope: 'NONE' }) }],
    })

    expect(toRolePayload(closed, [DEALS]).fields).toEqual([])
  })
})

describe('buildAccessLimits', () => {
  it('limits a member to their own effective access, table and field', () => {
    const member = buildMembership(['ROLES_MANAGE'])
    const limits = buildAccessLimits(member, {
      tables: [{ tableId: DEALS.id, ...ownOnly }],
      fields: [{ fieldId: 'fld_salary', access: 'READ' }],
    })

    expect(limits.tableAccess(DEALS.id)).toEqual(ownOnly)
    expect(limits.tableAccess('tbl_other')).toEqual(NO_TABLE_ACCESS)
    expect(limits.fieldAccess(DEALS.id, 'fld_salary')).toBe('READ')
  })

  it('limits the owner by nothing', () => {
    const limits = buildAccessLimits(buildMembership([], { isOwner: true }), {
      tables: [],
      fields: [],
    })

    expect(limits.tableAccess(DEALS.id)).toEqual(FULL_TABLE_ACCESS)
    expect(limits.fieldAccess(DEALS.id, 'fld_salary')).toBe('EDIT')
  })
})

describe('isRoleVisibilityBypassed', () => {
  it('holds for a role that manages tables only', () => {
    expect(isRoleVisibilityBypassed(role({ permissions: ['TABLES_MANAGE'] }))).toBe(true)
    expect(isRoleVisibilityBypassed(role({ permissions: ['ROLES_MANAGE'] }))).toBe(false)
  })
})
