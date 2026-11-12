import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { buildMembershipWhere, membershipSelect, toSharedMembership } from '#server/db/workspaces'
import type { INotFoundData } from '#shared/types/api'
import type { IWorkspaceMembership, TWorkspacePermission } from '#shared/types/workspace'
import { parseWorkspaceAddress } from '#shared/utils/address'
import { hasPermission } from '#shared/utils/permissions'

/**
 * `READ` is membership alone: every member may read everything in the workspace. `OWNER` is no
 * permission a role can grant — only `Workspace.ownerId` holds it.
 */
export type TWorkspaceAccess = TWorkspacePermission | 'READ' | 'OWNER'

const DENIED_ACTIONS: Record<Exclude<TWorkspaceAccess, 'READ'>, string> = {
  OWNER: 'do this — only the workspace owner can',
  WORKSPACE_UPDATE: 'change this workspace',
  MEMBERS_INVITE: 'invite people to this workspace',
  MEMBERS_MANAGE: 'manage the members of this workspace',
  ROLES_MANAGE: 'manage the roles of this workspace',
  TABLES_MANAGE: 'change the tables of this workspace',
  RECORDS_CREATE: 'add records',
  RECORDS_UPDATE: 'edit records',
  RECORDS_DELETE: 'delete records',
}

/** Also for a workspace that went between the membership check and the write. */
export function buildWorkspaceNotFoundError() {
  return createError<INotFoundData>({
    statusCode: 404,
    statusMessage: 'Workspace not found',
    data: { missing: 'workspace' },
  })
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

  if (!row) throw buildWorkspaceNotFoundError()

  return toSharedMembership(row, userId)
}

function hasAccess(
  membership: IWorkspaceMembership,
  access: Exclude<TWorkspaceAccess, 'READ'>,
): boolean {
  return access === 'OWNER' ? membership.isOwner : hasPermission(membership, access)
}

export function assertAccess(membership: IWorkspaceMembership, access: TWorkspaceAccess) {
  if (access === 'READ' || hasAccess(membership, access)) return

  throw createError({
    statusCode: 403,
    statusMessage: `You don't have permission to ${DENIED_ACTIONS[access]}`,
  })
}
