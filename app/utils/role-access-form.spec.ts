import { describe, expect, it } from 'vitest'
import {
  applyFieldAccess,
  applyTableOverride,
  buildAccessLimits,
  findFieldAccess,
  findTableOverride,
  isRoleVisibilityBypassed,
  resolveSubjectTableAccess,
  toRoleAccessPayload,
} from '~/utils/role-access-form'
import { FULL_TABLE_ACCESS } from '#shared/constants/workspace'
import type { IAccessTable } from '#shared/types/workspace'
import type { TRoleAccessInput } from '#shared/validation/role-access'
import { buildMembership, buildRecordDefaults } from '~~/test/membership'

const DEALS: IAccessTable = {
  id: 'tbl_deals',
  name: 'Deals',
  fields: [{ id: 'fld_salary', name: 'Salary', type: 'NUMBER', required: false }],
}

const access = (overrides: Partial<TRoleAccessInput> = {}): TRoleAccessInput => ({
  recordDefaults: buildRecordDefaults({ canCreate: true }),
  tables: [],
  fields: [],
  ...overrides,
})

const ownOnly = buildRecordDefaults({ readScope: 'OWN' })

describe('a table’s own setting', () => {
  it('is set, replaced and dropped back to the defaults', () => {
    const set = applyTableOverride(access(), DEALS.id, ownOnly)
    expect(findTableOverride(set, DEALS.id)).toEqual(ownOnly)

    const replaced = applyTableOverride(set, DEALS.id, FULL_TABLE_ACCESS)
    expect(replaced.tables).toEqual([{ tableId: DEALS.id, ...FULL_TABLE_ACCESS }])

    expect(findTableOverride(applyTableOverride(replaced, DEALS.id, null), DEALS.id)).toBeNull()
  })

  it('decides the role’s access to the table, the defaults otherwise', () => {
    expect(resolveSubjectTableAccess(access(), [], DEALS.id).canCreate).toBe(true)

    const narrowed = applyTableOverride(access(), DEALS.id, ownOnly)
    expect(resolveSubjectTableAccess(narrowed, [], DEALS.id)).toEqual(ownOnly)
  })
})

describe('a field’s access', () => {
  it('is editable without a row, and a row narrows it', () => {
    expect(findFieldAccess(access(), 'fld_salary')).toBe('EDIT')

    const hidden = applyFieldAccess(access(), 'fld_salary', 'HIDDEN')
    expect(hidden.fields).toEqual([{ fieldId: 'fld_salary', access: 'HIDDEN' }])
    expect(findFieldAccess(hidden, 'fld_salary')).toBe('HIDDEN')
  })

  it('drops its row when set back to editable', () => {
    const hidden = applyFieldAccess(access(), 'fld_salary', 'HIDDEN')

    expect(applyFieldAccess(hidden, 'fld_salary', 'EDIT').fields).toEqual([])
  })
})

describe('toRoleAccessPayload', () => {
  const hidden = [{ fieldId: 'fld_salary', access: 'HIDDEN' as const }]

  it('keeps the field rows of a table the role reads', () => {
    expect(toRoleAccessPayload(access({ fields: hidden }), [], [DEALS]).fields).toEqual(hidden)
  })

  it('drops the field rows of a table the role no longer reads, which the server would refuse', () => {
    const closed = access({
      fields: hidden,
      tables: [{ tableId: DEALS.id, ...buildRecordDefaults({ readScope: 'NONE' }) }],
    })

    expect(toRoleAccessPayload(closed, [], [DEALS]).fields).toEqual([])
  })
})

describe('buildAccessLimits', () => {
  it('limits a member to their own effective access, table and field', () => {
    const member = buildMembership(['ROLES_MANAGE'], { recordDefaults: FULL_TABLE_ACCESS })
    const limits = buildAccessLimits(member, {
      tables: [{ tableId: DEALS.id, ...ownOnly }],
      fields: [{ fieldId: 'fld_salary', access: 'READ' }],
    })

    expect(limits.defaults).toEqual(FULL_TABLE_ACCESS)
    expect(limits.tableAccess(DEALS.id)).toEqual(ownOnly)
    expect(limits.tableAccess('tbl_other')).toEqual(FULL_TABLE_ACCESS)
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
    expect(isRoleVisibilityBypassed(access(), ['TABLES_MANAGE'])).toBe(true)
    expect(isRoleVisibilityBypassed(access(), ['ROLES_MANAGE'])).toBe(false)
  })
})
