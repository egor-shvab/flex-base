import { IMPLIED_PERMISSIONS, RECORD_SCOPES } from '#shared/constants/workspace'
import type {
  IManagedMember,
  IRoleRef,
  ITableAccess,
  IWorkspaceActor,
  IWorkspaceMembership,
  IWorkspaceRole,
  TRecordAction,
  TRecordScope,
  TWorkspacePermission,
} from '#shared/types/workspace'

/**
 * The anti-escalation rules, one source for the server's refusals and the client's hidden
 * controls. Each `can*` answers only its rule; the route's own permission (`MEMBERS_MANAGE`,
 * `ROLES_MANAGE`, …) is checked before it.
 */

/** Whoever's permissions are asked about: the owner holds every one, whatever their role says. */
export type TPermissionHolder = Pick<IWorkspaceActor, 'isOwner' | 'permissions'>

/** Whether `permissions` bring `permission` without holding it (`IMPLIED_PERMISSIONS`). */
export function isPermissionImplied(
  permissions: readonly TWorkspacePermission[],
  permission: TWorkspacePermission,
): boolean {
  return (IMPLIED_PERMISSIONS[permission] ?? []).some((implying) => permissions.includes(implying))
}

export function hasPermission(actor: TPermissionHolder, permission: TWorkspacePermission): boolean {
  return (
    actor.isOwner ||
    actor.permissions.includes(permission) ||
    isPermissionImplied(actor.permissions, permission)
  )
}

/** Whether `access` allows the action on at least some records. */
export function hasRecordAction(access: ITableAccess, action: TRecordAction): boolean {
  if (action === 'create') return access.canCreate

  return (action === 'update' ? access.updateScope : access.deleteScope) !== 'NONE'
}

/** Each of `subset` held by `of`, implied ones counting: what may be granted without escalating. */
export function isPermissionSubset(
  subset: readonly TWorkspacePermission[],
  of: readonly TWorkspacePermission[],
): boolean {
  return subset.every((permission) =>
    hasPermission({ isOwner: false, permissions: of }, permission),
  )
}

export function isScopeWithin(scope: TRecordScope, of: TRecordScope): boolean {
  return RECORD_SCOPES.indexOf(scope) <= RECORD_SCOPES.indexOf(of)
}

export function isTableAccessWithin(access: ITableAccess, of: ITableAccess): boolean {
  return (
    isScopeWithin(access.readScope, of.readScope) &&
    (!access.canCreate || of.canCreate) &&
    isScopeWithin(access.updateScope, of.updateScope) &&
    isScopeWithin(access.deleteScope, of.deleteScope)
  )
}

export function isSameTableAccess(a: ITableAccess, b: ITableAccess): boolean {
  return (
    a.readScope === b.readScope &&
    a.canCreate === b.canCreate &&
    a.updateScope === b.updateScope &&
    a.deleteScope === b.deleteScope
  )
}

/**
 * Changing a member's role or removing them. Nobody acts on the owner's membership or on their
 * own — leaving is its own action — nor on one whose role grants more than they hold
 * (`isAccessWithin`, which the caller decides with the workspace's tables to hand).
 */
export function canManageMember(
  actor: Pick<IWorkspaceActor, 'memberId'>,
  member: IManagedMember,
  isRoleWithinActor: boolean,
): boolean {
  if (member.isOwner || member.id === actor.memberId) return false

  return isRoleWithinActor
}

/**
 * Only the owner changes the role they hold: anyone else could narrow it below what they need to
 * undo the change — their own role management, or a table they would no longer see.
 */
export function isHeldRoleLocked(
  actor: Pick<IWorkspaceMembership, 'isOwner'> & { role: IRoleRef | null },
  roleId: string,
): boolean {
  return !actor.isOwner && actor.role?.id === roleId
}

/**
 * Editing or deleting a role, from its page or a table's: the caller manages roles, the role is
 * within them (the server's answer, `isWithinCaller`), and it is not the one they hold.
 */
export function canEditRole(
  actor: Pick<IWorkspaceMembership, 'isOwner' | 'permissions'> & { role: IRoleRef | null },
  role: Pick<IWorkspaceRole, 'id' | 'isWithinCaller'>,
): boolean {
  return (
    hasPermission(actor, 'ROLES_MANAGE') && role.isWithinCaller && !isHeldRoleLocked(actor, role.id)
  )
}
