import type { Prisma } from '#server/generated/prisma/client'
import { isUniqueViolationOn } from '#server/db/prisma-errors'
import { buildPublicId } from '#server/utils/public-id'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type {
  IWorkspace,
  IWorkspaceMembership,
  TWorkspacePermission,
} from '#shared/types/workspace'

export const PERSONAL_WORKSPACE_NAME = 'Personal workspace'

interface IDefaultRole {
  name: string
  permissions: readonly TWorkspacePermission[]
}

/** The first is the owner's: they keep it after handing the workspace over. */
export const DEFAULT_WORKSPACE_ROLES = [
  { name: 'Admin', permissions: WORKSPACE_PERMISSIONS },
  { name: 'Editor', permissions: ['RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE'] },
  { name: 'Viewer', permissions: [] },
] as const satisfies readonly IDefaultRole[]

const PUBLIC_ID_ATTEMPTS = 3

export const workspaceSelect = {
  id: true,
  publicId: true,
  name: true,
  createdAt: true,
} satisfies Prisma.WorkspaceSelect

export const membershipSelect = {
  id: true,
  role: { select: { id: true, name: true, permissions: true } },
  workspace: { select: { ...workspaceSelect, ownerId: true } },
} satisfies Prisma.WorkspaceMemberSelect

export type TWorkspaceRow = Prisma.WorkspaceGetPayload<{ select: typeof workspaceSelect }>
export type TMembershipRow = Prisma.WorkspaceMemberGetPayload<{ select: typeof membershipSelect }>

export function buildMembershipWhere(
  userId: string,
  workspaceAddress: string,
): Prisma.WorkspaceMemberWhereInput {
  return { userId, workspace: { publicId: workspaceAddress } }
}

export function toSharedWorkspace(row: TWorkspaceRow): IWorkspace {
  return {
    id: row.id,
    publicId: row.publicId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toSharedMembership(row: TMembershipRow, userId: string): IWorkspaceMembership {
  const isOwner = row.workspace.ownerId === userId

  return {
    memberId: row.id,
    isOwner,
    permissions: isOwner ? [...WORKSPACE_PERMISSIONS] : row.role.permissions,
    workspace: toSharedWorkspace(row.workspace),
    role: { id: row.role.id, name: row.role.name },
  }
}

/**
 * The workspace, its default roles and the owner's membership — every new workspace, personal or
 * not, starts here. Runs inside the caller's transaction; returns the owner's membership.
 */
export async function createWorkspaceWithDefaults(
  tx: Prisma.TransactionClient,
  { ownerId, name }: { ownerId: string; name: string },
): Promise<TMembershipRow> {
  const workspace = await tx.workspace.create({
    data: {
      publicId: buildPublicId(),
      name,
      ownerId,
      roles: {
        create: DEFAULT_WORKSPACE_ROLES.map((role) => ({
          name: role.name,
          permissions: [...role.permissions],
        })),
      },
    },
    select: { id: true },
  })

  return tx.workspaceMember.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      user: { connect: { id: ownerId } },
      role: {
        connect: {
          workspaceId_name: { workspaceId: workspace.id, name: DEFAULT_WORKSPACE_ROLES[0].name },
        },
      },
    },
    select: membershipSelect,
  })
}

/**
 * A colliding public id aborts the whole transaction — PostgreSQL refuses every later statement in
 * it — so the retry reruns the transaction, never just the insert.
 */
export async function retryOnPublicIdCollision<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      if (attempt === PUBLIC_ID_ATTEMPTS || !isUniqueViolationOn(error, 'publicId')) throw error
    }
  }
}
