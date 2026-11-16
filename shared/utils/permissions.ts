import { RECORD_SCOPES } from '#shared/constants/workspace'
import type {
  IManagedMember,
  IPermissionSet,
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

type TPermissionHolder = Pick<IWorkspaceActor, 'isOwner' | 'permissions' | 'recordDefaults'>

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

function isWithinActor(actor: TPermissionHolder, set: IPermissionSet): boolean {
  return (
    actor.isOwner ||
    (isPermissionSubset(set.permissions, actor.permissions) &&
      isTableAccessWithin(set.recordDefaults, actor.recordDefaults))
  )
}

/** To a member or in an invitation: never a role granting more than the actor holds. */
export function canAssignRole(actor: TPermissionHolder, role: IPermissionSet): boolean {
  return isWithinActor(actor, role)
}

export function canCreateRole(actor: TPermissionHolder, set: IPermissionSet): boolean {
  return isWithinActor(actor, set)
}

/** Without `next` this answers renaming or deleting the role. */
export function canEditRole(
  actor: TPermissionHolder,
  role: IPermissionSet,
  next?: IPermissionSet,
): boolean {
  return isWithinActor(actor, role) && (next === undefined || isWithinActor(actor, next))
}

/**
 * Changing a member's role or removing them. Nobody acts on the owner's membership or on their
 * own — leaving is its own action.
 */
export function canManageMember(actor: IWorkspaceActor, member: IManagedMember): boolean {
  if (member.isOwner || member.id === actor.memberId) return false

  return isWithinActor(actor, member.role)
}
