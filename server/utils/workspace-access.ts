import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { buildMembershipWhere, membershipSelect, toSharedMembership } from '#server/db/workspaces'
import type { INotFoundData } from '#shared/types/api'
import type { IWorkspaceMembership, TWorkspacePermission } from '#shared/types/workspace'
import { parseWorkspaceAddress } from '#shared/utils/address'
import { hasPermission } from '#shared/utils/permissions'

/** `READ` is membership alone: every member may read everything in the workspace. */
export type TWorkspaceAccess = TWorkspacePermission | 'READ'

const DENIED_ACTIONS: Record<TWorkspacePermission, string> = {
  WORKSPACE_UPDATE: 'change this workspace',
  MEMBERS_INVITE: 'invite people to this workspace',
  MEMBERS_MANAGE: 'manage the members of this workspace',
  ROLES_MANAGE: 'manage the roles of this workspace',
  TABLES_MANAGE: 'change the tables of this workspace',
  RECORDS_CREATE: 'add records',
  RECORDS_UPDATE: 'edit records',
  RECORDS_DELETE: 'delete records',
}

/**
 * One query from the caller's id and the address: a workspace they are not in is
 * indistinguishable from one that does not exist, so both are 404.
 */
export async function requireMembership(
  userId: string,
  workspaceAddress: string,
): Promise<IWorkspaceMembership> {
  const row = await prisma.workspaceMember.findFirst({
    where: buildMembershipWhere(userId, parseWorkspaceAddress(workspaceAddress)),
    select: membershipSelect,
  })

  if (!row) {
    throw createError<INotFoundData>({
      statusCode: 404,
      statusMessage: 'Workspace not found',
      data: { missing: 'workspace' },
    })
  }

  return toSharedMembership(row, userId)
}

export function assertPermission(membership: IWorkspaceMembership, access: TWorkspaceAccess) {
  if (access === 'READ' || hasPermission(membership, access)) return

  throw createError({
    statusCode: 403,
    statusMessage: `You don't have permission to ${DENIED_ACTIONS[access]}`,
  })
}
