import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { buildRoleWhere, roleSelect, toSharedRole } from '#server/db/workspaces'
import { toHttpError } from '#server/utils/http-errors'
import type { IPermissionSet, IWorkspaceMembership, IWorkspaceRole } from '#shared/types/workspace'
import { canAssignRole, canCreateRole, canEditRole } from '#shared/utils/permissions'
import type { TRoleInput } from '#shared/validation/workspace'

export const MAX_WORKSPACE_ROLES = 20

const roleErrors = {
  conflict: 'A role with this name already exists',
  notFound: 'Role not found',
}

function buildEscalationError() {
  return createError({
    statusCode: 403,
    statusMessage: 'You can only manage roles within your own permissions',
  })
}

async function listRoles(workspaceId: string): Promise<IWorkspaceRole[]> {
  // The default roles share one `createdAt`: the name keeps their order stable
  const rows = await prisma.workspaceRole.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    select: roleSelect,
  })

  return rows.map(toSharedRole)
}

async function getRole(workspaceId: string, roleId: string): Promise<IPermissionSet> {
  const role = await prisma.workspaceRole.findUnique({
    where: buildRoleWhere(workspaceId, roleId),
    select: { permissions: true },
  })

  if (!role) throw createError({ statusCode: 404, statusMessage: roleErrors.notFound })

  return role
}

/** A role of the actor's workspace they may hand out: to a member, or in an invitation. */
async function requireAssignableRole(actor: IWorkspaceMembership, roleId: string): Promise<void> {
  const role = await getRole(actor.workspace.id, roleId)

  if (!canAssignRole(actor, role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only assign roles within your own permissions',
    })
  }
}

/**
 * The cap is counted, not locked: two creates racing past the count can land one role over it.
 * It bounds the list a page renders, which one extra role does not break.
 */
async function createRole(actor: IWorkspaceMembership, input: TRoleInput): Promise<IWorkspaceRole> {
  if (!canCreateRole(actor, input.permissions)) throw buildEscalationError()

  const workspaceId = actor.workspace.id
  const roleCount = await prisma.workspaceRole.count({ where: { workspaceId } })

  if (roleCount >= MAX_WORKSPACE_ROLES) {
    throw createError({
      statusCode: 409,
      statusMessage: `A workspace can have at most ${MAX_WORKSPACE_ROLES} roles`,
    })
  }

  try {
    return toSharedRole(
      await prisma.workspaceRole.create({
        data: { workspaceId, name: input.name, permissions: input.permissions },
        select: roleSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, roleErrors)
  }
}

async function updateRole(
  actor: IWorkspaceMembership,
  roleId: string,
  input: TRoleInput,
): Promise<IWorkspaceRole> {
  const role = await getRole(actor.workspace.id, roleId)
  if (!canEditRole(actor, role, input.permissions)) throw buildEscalationError()

  try {
    return toSharedRole(
      await prisma.workspaceRole.update({
        where: buildRoleWhere(actor.workspace.id, roleId),
        data: { name: input.name, permissions: input.permissions },
        select: roleSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, roleErrors)
  }
}

/**
 * A role a member or an invitation still holds is refused by its foreign key, not by a count read
 * first.
 */
async function deleteRole(actor: IWorkspaceMembership, roleId: string): Promise<void> {
  const role = await getRole(actor.workspace.id, roleId)
  if (!canEditRole(actor, role)) throw buildEscalationError()

  try {
    await prisma.workspaceRole.delete({
      where: buildRoleWhere(actor.workspace.id, roleId),
      select: { id: true },
    })
  } catch (error) {
    throw toHttpError(error, {
      ...roleErrors,
      inUse: 'Reassign the members of this role and revoke its invitations first',
    })
  }
}

export const RoleService = {
  listRoles,
  requireAssignableRole,
  createRole,
  updateRole,
  deleteRole,
}
