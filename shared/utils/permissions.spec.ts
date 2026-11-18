import { describe, expect, it } from 'vitest'
import { buildTableAccess } from '~~/test/membership'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IManagedMember, IWorkspaceActor, TWorkspacePermission } from '#shared/types/workspace'
import {
  canEditRole,
  canManageMember,
  hasPermission,
  hasRecordAction,
  isPermissionSubset,
  isSameTableAccess,
  isScopeWithin,
  isTableAccessWithin,
} from '#shared/utils/permissions'

const MANAGEMENT: TWorkspacePermission[] = ['MEMBERS_MANAGE', 'ROLES_MANAGE', 'TABLES_MANAGE']

const owner: IWorkspaceActor = {
  memberId: 'mem_owner',
  isOwner: true,
  permissions: [],
}

/** A manager who may handle members and roles, and add and edit records — but not delete them. */
const managerRecords = buildTableAccess({ canCreate: true, updateScope: 'ALL' })
const manager: IWorkspaceActor = {
  memberId: 'mem_manager',
  isOwner: false,
  permissions: ['MEMBERS_MANAGE', 'ROLES_MANAGE'],
}

const member = (overrides: Partial<IManagedMember> = {}): IManagedMember => ({
  id: 'mem_other',
  isOwner: false,
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
    expect(hasRecordAction(buildTableAccess({ canCreate: true }), 'create')).toBe(true)
    expect(hasRecordAction(buildTableAccess(), 'create')).toBe(false)
  })

  it.each([
    ['NONE', false],
    ['OWN', true],
    ['ALL', true],
  ] as const)('holds an edit or delete scoped to %s: %s', (scope, expected) => {
    const access = buildTableAccess({ updateScope: scope, deleteScope: scope })

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
    expect(isTableAccessWithin(buildTableAccess({ readScope: 'OWN' }), managerRecords)).toBe(true)
  })

  it.each([
    ['reading', { readScope: 'ALL' }, { readScope: 'OWN' }],
    ['adding', { canCreate: true }, {}],
    ['editing', { updateScope: 'OWN' }, {}],
    ['deleting', { deleteScope: 'ALL' }, { deleteScope: 'OWN' }],
  ] as const)('fails on wider %s', (_, access, of) => {
    expect(isTableAccessWithin(buildTableAccess(access), buildTableAccess(of))).toBe(false)
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

describe('isSameTableAccess', () => {
  it('is true only when all four columns match', () => {
    expect(isSameTableAccess(managerRecords, { ...managerRecords })).toBe(true)
    expect(isSameTableAccess(managerRecords, { ...managerRecords, deleteScope: 'OWN' })).toBe(false)
    expect(isSameTableAccess(managerRecords, { ...managerRecords, canCreate: false })).toBe(false)
  })
})

describe('canEditRole', () => {
  const holding = (roleId: string, permissions: TWorkspacePermission[], isOwner = false) => ({
    isOwner,
    permissions,
    role: { id: roleId, name: 'Manager' },
  })
  const editable = { id: 'rol_other', isWithinCaller: true }

  it('lets a role manager edit a role within them that they do not hold', () => {
    expect(canEditRole(holding('rol_mine', ['ROLES_MANAGE']), editable)).toBe(true)
  })

  it.each([
    ['without role management', holding('rol_mine', []), editable],
    ['beyond them', holding('rol_mine', ['ROLES_MANAGE']), { ...editable, isWithinCaller: false }],
    ['they hold', holding('rol_other', ['ROLES_MANAGE']), editable],
  ])('refuses a role %s', (_, actor, subject) => {
    expect(canEditRole(actor, subject)).toBe(false)
  })

  it('lets the owner edit the role they hold', () => {
    expect(canEditRole(holding('rol_other', [], true), editable)).toBe(true)
  })
})
