import type {
  IManagedMember,
  IPermissionSet,
  IWorkspaceActor,
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

export function isPermissionSubset(
  subset: readonly TWorkspacePermission[],
  of: readonly TWorkspacePermission[],
): boolean {
  return subset.every((permission) => of.includes(permission))
}

function isWithinActor(
  actor: TPermissionHolder,
  permissions: readonly TWorkspacePermission[],
): boolean {
  return actor.isOwner || isPermissionSubset(permissions, actor.permissions)
}

/** To a member or in an invitation: never a role granting more than the actor holds. */
export function canAssignRole(actor: TPermissionHolder, role: IPermissionSet): boolean {
  return isWithinActor(actor, role.permissions)
}

export function canCreateRole(
  actor: TPermissionHolder,
  permissions: readonly TWorkspacePermission[],
): boolean {
  return isWithinActor(actor, permissions)
}

/** Without `nextPermissions` this answers renaming or deleting the role. */
export function canEditRole(
  actor: TPermissionHolder,
  role: IPermissionSet,
  nextPermissions?: readonly TWorkspacePermission[],
): boolean {
  return (
    isWithinActor(actor, role.permissions) &&
    (nextPermissions === undefined || isWithinActor(actor, nextPermissions))
  )
}

/**
 * Changing a member's role or removing them. Nobody acts on the owner's membership or on their
 * own — leaving is its own action.
 */
export function canManageMember(actor: IWorkspaceActor, member: IManagedMember): boolean {
  if (member.isOwner || member.id === actor.memberId) return false

  return isWithinActor(actor, member.role.permissions)
}
