import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import {
  buildPermissionSetWhere,
  buildRoleWhere,
  permissionSetSelect,
  roleSelect,
  toPermissionSet,
  toSharedRole,
} from '#server/db/workspaces'
import { isForeignKeyViolation, isMissingRow } from '#server/db/prisma-errors'
import {
  buildChangedMeanwhileError,
  buildStaleWriteError,
  toHttpError,
} from '#server/utils/http-errors'
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
    select: permissionSetSelect,
  })

  if (!role) throw createError({ statusCode: 404, statusMessage: roleErrors.notFound })

  return toPermissionSet(role)
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
  if (!canCreateRole(actor, input)) throw buildEscalationError()

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
        data: { workspaceId, ...toRoleData(input) },
        select: roleSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, roleErrors)
  }
}

/** Given the version the caller read, the write lands only on that version (as `updateRecord`). */
async function updateRole(
  actor: IWorkspaceMembership,
  roleId: string,
  input: TRoleInput,
  expectedUpdatedAt?: Date,
): Promise<IWorkspaceRole> {
  const role = await getRole(actor.workspace.id, roleId)
  if (!canEditRole(actor, role, input)) throw buildEscalationError()

  const where = buildRoleWhere(actor.workspace.id, roleId)

  try {
    return toSharedRole(
      await prisma.workspaceRole.update({
        where: {
          ...buildGuardedRoleWhere(where, role),
          ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
        },
        data: toRoleData(input),
        select: roleSelect,
      }),
    )
  } catch (error) {
    throw await toRoleWriteError(error, where, expectedUpdatedAt !== undefined)
  }
}

/** The grants the decision read are repeated in the write, as for a member's role. */
function buildGuardedRoleWhere(
  where: ReturnType<typeof buildRoleWhere>,
  role: IPermissionSet,
): ReturnType<typeof buildRoleWhere> {
  return { ...where, ...buildPermissionSetWhere(role) }
}

function toRoleData(input: TRoleInput) {
  return { name: input.name, permissions: input.permissions, ...input.recordDefaults }
}

/** A miss on a role still there: stale in the form (412), or changed under the check (409). */
async function toRoleWriteError(
  error: unknown,
  where: ReturnType<typeof buildRoleWhere>,
  hasClientVersion: boolean,
) {
  if (isMissingRow(error)) {
    const current = await prisma.workspaceRole.findUnique({ where, select: { id: true } })
    if (current) {
      return hasClientVersion ? buildStaleWriteError('role') : buildChangedMeanwhileError('role')
    }
  }
  return toHttpError(error, roleErrors)
}

/**
 * A role a member or an invitation still holds is refused by its foreign key, not by a count read
 * first.
 */
async function deleteRole(actor: IWorkspaceMembership, roleId: string): Promise<void> {
  const role = await getRole(actor.workspace.id, roleId)
  if (!canEditRole(actor, role)) throw buildEscalationError()

  const where = buildRoleWhere(actor.workspace.id, roleId)

  try {
    await prisma.workspaceRole.delete({
      where: buildGuardedRoleWhere(where, role),
      select: { id: true },
    })
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw toHttpError(error, {
        inUse: 'Reassign the members of this role and revoke its invitations first',
      })
    }
    throw await toRoleWriteError(error, where, false)
  }
}

export const RoleService = {
  listRoles,
  requireAssignableRole,
  createRole,
  updateRole,
  deleteRole,
}
