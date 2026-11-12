import { createError } from 'h3'
import { dropFieldIndexes, listIndexedFieldIds } from '#server/db/field-indexes'
import { prisma } from '#server/db/prisma'
import { isMissingRow } from '#server/db/prisma-errors'
import {
  createWorkspaceWithDefaults,
  membershipSelect,
  retryOnPublicIdCollision,
  toSharedMembership,
  toSharedWorkspace,
  workspaceSelect,
} from '#server/db/workspaces'
import { MemberService } from '#server/services/members'
import { recordBackgroundFailure } from '#server/utils/error-log-file'
import { toHttpError } from '#server/utils/http-errors'
import { buildWorkspaceNotFoundError } from '#server/utils/workspace-access'
import type { IWorkspacesResponse } from '#shared/types/api'
import type { IWorkspace, IWorkspaceMembership } from '#shared/types/workspace'

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

async function createWorkspace(userId: string, name: string): Promise<IWorkspaceMembership> {
  const row = await retryOnPublicIdCollision(() =>
    prisma.$transaction((tx) => createWorkspaceWithDefaults(tx, { ownerId: userId, name })),
  )

  return toSharedMembership(row, userId)
}

function toWorkspaceWriteError(error: unknown): unknown {
  return isMissingRow(error) ? buildWorkspaceNotFoundError() : error
}

/** The caller has already proved the right to change the workspace. */
async function renameWorkspace(workspaceId: string, name: string): Promise<IWorkspace> {
  try {
    return toSharedWorkspace(
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { name },
        select: workspaceSelect,
      }),
    )
  } catch (error) {
    throw toWorkspaceWriteError(error)
  }
}

/**
 * The caller has already proved ownership. Tables, fields, records, roles and memberships go with
 * it by cascade, and every `User.lastWorkspaceId` pointing at it is nulled.
 */
async function deleteWorkspace(workspaceId: string): Promise<void> {
  const indexedFieldIds = await listIndexedFieldIds({ table: { workspaceId } })

  try {
    await prisma.workspace.delete({ where: { id: workspaceId }, select: { id: true } })
  } catch (error) {
    throw toWorkspaceWriteError(error)
  }

  void dropFieldIndexes(indexedFieldIds).catch(recordBackgroundFailure)
}

/**
 * The caller has already proved ownership. They stay a member under the role they held, which is
 * why the owner always has one. The guard in the `where` refuses a member removed since the read.
 */
async function transferOwnership(actor: IWorkspaceMembership, memberId: string): Promise<void> {
  if (memberId === actor.memberId) {
    throw createError({ statusCode: 409, statusMessage: 'You already own this workspace' })
  }

  const target = await MemberService.getMember(actor.workspace.id, memberId)

  try {
    await prisma.workspace.update({
      where: { id: actor.workspace.id, members: { some: { id: memberId } } },
      data: { ownerId: target.userId },
      select: { id: true },
    })
  } catch (error) {
    throw toHttpError(error, { notFound: 'Member not found' })
  }
}

/** The owner cannot leave: a workspace always has one, and they are always a member. */
async function leaveWorkspace(membership: IWorkspaceMembership): Promise<void> {
  if (membership.isOwner) {
    throw createError({ statusCode: 409, statusMessage: 'Transfer ownership before leaving' })
  }

  try {
    await prisma.workspaceMember.delete({
      where: { id: membership.memberId },
      select: { id: true },
    })
  } catch (error) {
    throw toWorkspaceWriteError(error)
  }
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
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
  transferOwnership,
  leaveWorkspace,
  setLastWorkspace,
}
