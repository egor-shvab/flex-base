import { describe, expect, it } from 'vitest'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IManagedMember, IWorkspaceActor, TWorkspacePermission } from '#shared/types/workspace'
import {
  canAssignRole,
  canCreateRole,
  canEditRole,
  canManageMember,
  hasPermission,
  isPermissionSubset,
} from '#shared/utils/permissions'

const RECORDS: TWorkspacePermission[] = ['RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE']

const owner: IWorkspaceActor = { memberId: 'mem_owner', isOwner: true, permissions: [] }

/** A manager who may handle members and roles, and edit records — but not delete them. */
const manager: IWorkspaceActor = {
  memberId: 'mem_manager',
  isOwner: false,
  permissions: ['MEMBERS_MANAGE', 'ROLES_MANAGE', 'RECORDS_CREATE', 'RECORDS_UPDATE'],
}

const role = (...permissions: TWorkspacePermission[]) => ({ permissions })

const member = (
  overrides: Partial<IManagedMember> = {},
  ...permissions: TWorkspacePermission[]
): IManagedMember => ({ id: 'mem_other', isOwner: false, role: role(...permissions), ...overrides })

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
    expect(isPermissionSubset(RECORDS, [...RECORDS].reverse())).toBe(true)
  })

  it('holds for the empty set', () => {
    expect(isPermissionSubset([], [])).toBe(true)
  })

  it('fails on a single permission the other lacks', () => {
    expect(isPermissionSubset(RECORDS, ['RECORDS_CREATE', 'RECORDS_UPDATE'])).toBe(false)
  })
})

describe('canAssignRole', () => {
  it.each([
    ['a subset of their own', role('RECORDS_CREATE'), true],
    ['exactly their own', role(...manager.permissions), true],
    ['no permissions at all', role(), true],
    ['one permission more', role('RECORDS_CREATE', 'RECORDS_DELETE'), false],
  ])('lets a member assign a role holding %s: %s', (_, assigned, expected) => {
    expect(canAssignRole(manager, assigned)).toBe(expected)
  })

  it('lets the owner assign any role', () => {
    expect(canAssignRole(owner, role(...WORKSPACE_PERMISSIONS))).toBe(true)
  })
})

describe('canCreateRole', () => {
  it('refuses a member a role that would grant what they lack', () => {
    expect(canCreateRole(manager, ['RECORDS_DELETE'])).toBe(false)
    expect(canCreateRole(manager, ['RECORDS_UPDATE'])).toBe(true)
  })

  it('lets the owner create any role', () => {
    expect(canCreateRole(owner, WORKSPACE_PERMISSIONS)).toBe(true)
  })
})

describe('canEditRole', () => {
  it('lets a member rename or delete a role within their own permissions', () => {
    expect(canEditRole(manager, role('RECORDS_CREATE'))).toBe(true)
  })

  it('refuses a member a role that already exceeds them, even to narrow it', () => {
    expect(canEditRole(manager, role('RECORDS_DELETE'))).toBe(false)
    expect(canEditRole(manager, role('RECORDS_DELETE'), [])).toBe(false)
  })

  it('refuses a member widening a role past their own permissions', () => {
    expect(canEditRole(manager, role('RECORDS_CREATE'), ['RECORDS_CREATE', 'TABLES_MANAGE'])).toBe(
      false,
    )
  })

  it('lets a member reshape a role within their own permissions', () => {
    expect(canEditRole(manager, role('RECORDS_CREATE'), ['RECORDS_UPDATE'])).toBe(true)
  })

  it('lets the owner edit any role, to anything', () => {
    expect(canEditRole(owner, role(...WORKSPACE_PERMISSIONS), [])).toBe(true)
    expect(canEditRole(owner, role(), WORKSPACE_PERMISSIONS)).toBe(true)
  })
})

describe('canManageMember', () => {
  it('lets a member manage someone whose role is within their own', () => {
    expect(canManageMember(manager, member({}, 'RECORDS_CREATE'))).toBe(true)
  })

  it('refuses a member someone whose role exceeds their own', () => {
    expect(canManageMember(manager, member({}, 'RECORDS_DELETE'))).toBe(false)
  })

  it('lets the owner manage any other member', () => {
    expect(canManageMember(owner, member({}, ...WORKSPACE_PERMISSIONS))).toBe(true)
  })

  it('refuses everyone their own membership, the owner included', () => {
    expect(canManageMember(manager, member({ id: manager.memberId }))).toBe(false)
    expect(canManageMember(owner, member({ id: owner.memberId, isOwner: true }))).toBe(false)
  })

  it('refuses everyone the owner’s membership, whatever the owner’s role holds', () => {
    expect(canManageMember(manager, member({ id: 'mem_owner', isOwner: true }))).toBe(false)
  })
})
