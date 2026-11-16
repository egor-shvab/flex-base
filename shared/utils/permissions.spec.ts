import { describe, expect, it } from 'vitest'
import { buildRecordDefaults } from '~~/test/membership'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  IManagedMember,
  IPermissionSet,
  ITableAccess,
  IWorkspaceActor,
  TWorkspacePermission,
} from '#shared/types/workspace'
import {
  canManageMember,
  hasPermission,
  hasRecordAction,
  isPermissionSubset,
  isScopeWithin,
  isTableAccessWithin,
} from '#shared/utils/permissions'

const MANAGEMENT: TWorkspacePermission[] = ['MEMBERS_MANAGE', 'ROLES_MANAGE', 'TABLES_MANAGE']

const owner: IWorkspaceActor = {
  memberId: 'mem_owner',
  isOwner: true,
  permissions: [],
  recordDefaults: buildRecordDefaults(),
}

/** A manager who may handle members and roles, and add and edit records — but not delete them. */
const managerRecords = buildRecordDefaults({ canCreate: true, updateScope: 'ALL' })
const manager: IWorkspaceActor = {
  memberId: 'mem_manager',
  isOwner: false,
  permissions: ['MEMBERS_MANAGE', 'ROLES_MANAGE'],
  recordDefaults: managerRecords,
}

const role = (
  permissions: TWorkspacePermission[] = [],
  records: Partial<ITableAccess> = {},
): IPermissionSet => ({ permissions, recordDefaults: buildRecordDefaults(records) })

const member = (overrides: Partial<IManagedMember> = {}, assigned = role()): IManagedMember => ({
  id: 'mem_other',
  isOwner: false,
  role: assigned,
  ...overrides,
})

describe('hasPermission', () => {
  it('reads a member’s permission off their role', () => {
    expect(hasPermission(manager, 'ROLES_MANAGE')).toBe(true)
    expect(hasPermission(manager, 'TABLES_MANAGE')).toBe(false)
  })

  it('grants the owner everything, whatever their role holds', () => {
    for (const permission of WORKSPACE_PERMISSIONS) {
      expect(hasPermission(owner, permission)).toBe(true)
    }
  })
})

describe('isPermissionSubset', () => {
  it('holds for equal sets, in any order', () => {
    expect(isPermissionSubset(MANAGEMENT, [...MANAGEMENT].reverse())).toBe(true)
  })

  it('holds for the empty set', () => {
    expect(isPermissionSubset([], [])).toBe(true)
  })

  it('fails on a single permission the other lacks', () => {
    expect(isPermissionSubset(MANAGEMENT, ['MEMBERS_MANAGE', 'ROLES_MANAGE'])).toBe(false)
  })
})

describe('hasRecordAction', () => {
  it('reads adding off its flag', () => {
    expect(hasRecordAction(buildRecordDefaults({ canCreate: true }), 'create')).toBe(true)
    expect(hasRecordAction(buildRecordDefaults(), 'create')).toBe(false)
  })

  it.each([
    ['NONE', false],
    ['OWN', true],
    ['ALL', true],
  ] as const)('holds an edit or delete scoped to %s: %s', (scope, expected) => {
    const access = buildRecordDefaults({ updateScope: scope, deleteScope: scope })

    expect(hasRecordAction(access, 'update')).toBe(expected)
    expect(hasRecordAction(access, 'delete')).toBe(expected)
  })
})

describe('isScopeWithin', () => {
  it.each([
    ['NONE', 'NONE', true],
    ['NONE', 'ALL', true],
    ['OWN', 'ALL', true],
    ['ALL', 'ALL', true],
    ['OWN', 'NONE', false],
    ['ALL', 'OWN', false],
  ] as const)('%s within %s: %s', (scope, of, expected) => {
    expect(isScopeWithin(scope, of)).toBe(expected)
  })
})

describe('isTableAccessWithin', () => {
  it('holds for equal access', () => {
    expect(isTableAccessWithin(managerRecords, managerRecords)).toBe(true)
  })

  it('holds for narrower access', () => {
    expect(isTableAccessWithin(buildRecordDefaults({ readScope: 'OWN' }), managerRecords)).toBe(
      true,
    )
  })

  it.each([
    ['reading', { readScope: 'ALL' }, { readScope: 'OWN' }],
    ['adding', { canCreate: true }, {}],
    ['editing', { updateScope: 'OWN' }, {}],
    ['deleting', { deleteScope: 'ALL' }, { deleteScope: 'OWN' }],
  ] as const)('fails on wider %s', (_, access, of) => {
    expect(isTableAccessWithin(buildRecordDefaults(access), buildRecordDefaults(of))).toBe(false)
  })
})

describe('canManageMember', () => {
  it('lets a member manage someone whose role is within their own', () => {
    expect(canManageMember(manager, member(), true)).toBe(true)
  })

  it('refuses a member someone whose role exceeds their own', () => {
    expect(canManageMember(manager, member(), false)).toBe(false)
  })

  it('refuses everyone their own membership, the owner included', () => {
    expect(canManageMember(manager, member({ id: manager.memberId }), true)).toBe(false)
    expect(canManageMember(owner, member({ id: owner.memberId, isOwner: true }), true)).toBe(false)
  })

  it('refuses everyone the owner’s membership, whatever the owner’s role holds', () => {
    expect(canManageMember(manager, member({ id: 'mem_owner', isOwner: true }), true)).toBe(false)
  })
})
