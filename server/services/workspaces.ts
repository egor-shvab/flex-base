import { prisma } from '#server/db/prisma'
import { membershipSelect, toSharedMembership } from '#server/db/workspaces'
import type { IWorkspacesResponse } from '#shared/types/api'

async function listMemberships(userId: string): Promise<IWorkspacesResponse> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      lastWorkspaceId: true,
      memberships: { orderBy: { createdAt: 'asc' }, select: membershipSelect },
    },
  })

  const memberships = user.memberships.map((row) => toSharedMembership(row, userId))
  const lastWorkspace = memberships.find(
    (membership) => membership.workspace.id === user.lastWorkspaceId,
  )

  return { memberships, lastWorkspaceAddress: lastWorkspace?.workspace.publicId ?? null }
}

/** The caller has already proved membership of the workspace. */
async function setLastWorkspace(userId: string, workspaceId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastWorkspaceId: workspaceId },
    select: { id: true },
  })
}

export const WorkspaceService = {
  listMemberships,
  setLastWorkspace,
}
