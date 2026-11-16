import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { buildMembershipWhere, membershipSelect, toSharedMembership } from '#server/db/workspaces'
import type { INotFoundData } from '#shared/types/api'
import type {
  IWorkspaceMembership,
  TRecordAction,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { parseWorkspaceAddress } from '#shared/utils/address'
import { hasPermission, hasRecordAction } from '#shared/utils/permissions'

/** A record action, granted by the role's record defaults rather than by a permission. */
type TRecordAccess = 'RECORDS_CREATE' | 'RECORDS_UPDATE' | 'RECORDS_DELETE'

/**
 * `READ` is membership alone: every member may read everything in the workspace. `OWNER` is no
 * permission a role can grant — only `Workspace.ownerId` holds it.
 */
export type TWorkspaceAccess = TWorkspacePermission | TRecordAccess | 'READ' | 'OWNER'

const RECORD_ACCESS: Record<TRecordAccess, TRecordAction> = {
  RECORDS_CREATE: 'create',
  RECORDS_UPDATE: 'update',
  RECORDS_DELETE: 'delete',
}

function isRecordAccess(access: TWorkspaceAccess): access is TRecordAccess {
  return access in RECORD_ACCESS
}

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
  if (access === 'OWNER') return membership.isOwner
  if (isRecordAccess(access))
    return hasRecordAction(membership.recordDefaults, RECORD_ACCESS[access])

  return hasPermission(membership, access)
}

export function assertAccess(membership: IWorkspaceMembership, access: TWorkspaceAccess) {
  if (access === 'READ' || hasAccess(membership, access)) return

  throw createError({
    statusCode: 403,
    statusMessage: `You don't have permission to ${DENIED_ACTIONS[access]}`,
  })
}
