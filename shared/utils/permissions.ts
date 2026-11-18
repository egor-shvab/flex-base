import { RECORD_SCOPES } from '#shared/constants/workspace'
import type {
  IManagedMember,
  ITableAccess,
  IWorkspaceActor,
  TRecordAction,
  TRecordScope,
  TWorkspacePermission,
} from '#shared/types/workspace'

/**
 * The anti-escalation rules, one source for the server's refusals and the client's hidden
 * controls. Each `can*` answers only its rule; the route's own permission (`MEMBERS_MANAGE`,
 * `ROLES_MANAGE`, …) is checked before it.
 */

type TPermissionHolder = Pick<IWorkspaceActor, 'isOwner' | 'permissions'>

export function hasPermission(actor: TPermissionHolder, permission: TWorkspacePermission): boolean {
  return actor.isOwner || actor.permissions.includes(permission)
}

/** Whether `access` allows the action on at least some records. */
export function hasRecordAction(access: ITableAccess, action: TRecordAction): boolean {
  if (action === 'create') return access.canCreate

  return (action === 'update' ? access.updateScope : access.deleteScope) !== 'NONE'
}

export function isPermissionSubset(
  subset: readonly TWorkspacePermission[],
  of: readonly TWorkspacePermission[],
): boolean {
  return subset.every((permission) => of.includes(permission))
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
