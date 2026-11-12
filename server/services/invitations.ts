import { createError } from 'h3'
import {
  buildIncomingInvitationWhere,
  incomingInvitationSelect,
  invitationSelect,
  toIncomingInvitation,
  toInvitationEmail,
  toSharedInvitation,
} from '#server/db/invitations'
import { prisma } from '#server/db/prisma'
import { isMissingRow, isUniqueViolation } from '#server/db/prisma-errors'
import { membershipSelect, toSharedMembership } from '#server/db/workspaces'
import { RoleService } from '#server/services/roles'
import { toHttpError } from '#server/utils/http-errors'
import { INVITATION_TTL_DAYS } from '#shared/constants/workspace'
import type { IAuthUser } from '#shared/types/auth'
import type {
  IIncomingInvitation,
  IWorkspaceInvitation,
  IWorkspaceMembership,
} from '#shared/types/workspace'
import type { TInvitationInput } from '#shared/validation/workspace'

export const MAX_PENDING_INVITATIONS = 50

const DAY_MS = 24 * 60 * 60 * 1000

function buildNoLongerValidError() {
  return createError({ statusCode: 404, statusMessage: 'This invitation is no longer valid' })
}

/** Expired ones too: until revoked or sent again, they still hold their role. */
async function listInvitations(workspaceId: string): Promise<IWorkspaceInvitation[]> {
  const now = new Date()
  const rows = await prisma.workspaceInvitation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    select: invitationSelect,
  })

  return rows.map((row) => toSharedInvitation(row, now))
}

/**
 * Sending to an address already invited renews that invitation. Whether the address belongs to an
 * account is never read, so the answer cannot tell. The cap is counted, not locked, as the roles'
 * is.
 */
async function createInvitation(
  actor: IWorkspaceMembership,
  inviterId: string,
  input: TInvitationInput,
): Promise<IWorkspaceInvitation> {
  const workspaceId = actor.workspace.id
  const email = toInvitationEmail(input.email)
  await RoleService.requireAssignableRole(actor, input.roleId)

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { email: { equals: email, mode: 'insensitive' } } },
    select: { id: true },
  })
  if (member) {
    throw createError({ statusCode: 409, statusMessage: 'This person is already a member' })
  }

  const now = new Date()
  const pendingCount = await prisma.workspaceInvitation.count({
    where: { workspaceId, email: { not: email }, expiresAt: { gt: now } },
  })
  if (pendingCount >= MAX_PENDING_INVITATIONS) {
    throw createError({
      statusCode: 409,
      statusMessage: `A workspace can have at most ${MAX_PENDING_INVITATIONS} pending invitations`,
    })
  }

  const renewal = {
    roleId: input.roleId,
    invitedById: inviterId,
    expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS),
  }
  const row = await prisma.workspaceInvitation.upsert({
    where: { workspaceId_email: { workspaceId, email } },
    create: { workspaceId, email, ...renewal },
    update: renewal,
    select: invitationSelect,
  })

  return toSharedInvitation(row, now)
}

async function revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
  try {
    await prisma.workspaceInvitation.delete({
      where: { id: invitationId, workspaceId },
      select: { id: true },
    })
  } catch (error) {
    throw toHttpError(error, { notFound: 'Invitation not found' })
  }
}

async function listIncomingInvitations(user: IAuthUser): Promise<IIncomingInvitation[]> {
  const rows = await prisma.workspaceInvitation.findMany({
    where: buildIncomingInvitationWhere(user.email, new Date()),
    orderBy: { createdAt: 'desc' },
    select: incomingInvitationSelect,
  })

  return rows.map(toIncomingInvitation)
}

/**
 * The invitation is deleted before the membership is created: a second accept racing this one
 * waits on the row, then finds it gone. Someone already a member just loses the invitation.
 */
async function acceptInvitation(
  user: IAuthUser,
  invitationId: string,
): Promise<IWorkspaceMembership> {
  const where = { ...buildIncomingInvitationWhere(user.email, new Date()), id: invitationId }
  const invitation = await prisma.workspaceInvitation.findFirst({
    where,
    select: { workspaceId: true, roleId: true },
  })
  if (!invitation) throw buildNoLongerValidError()

  const { workspaceId, roleId } = invitation

  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.delete({ where, select: { id: true } })
      return tx.workspaceMember.create({
        data: { workspaceId, userId: user.id, roleId },
        select: membershipSelect,
      })
    })
    return toSharedMembership(row, user.id)
  } catch (error) {
    if (isMissingRow(error)) throw buildNoLongerValidError()
    if (!isUniqueViolation(error)) throw error
  }

  await prisma.workspaceInvitation.deleteMany({ where: { id: invitationId } })
  const row = await prisma.workspaceMember.findFirstOrThrow({
    where: { workspaceId, userId: user.id },
    select: membershipSelect,
  })
  return toSharedMembership(row, user.id)
}

async function declineInvitation(user: IAuthUser, invitationId: string): Promise<void> {
  const { count } = await prisma.workspaceInvitation.deleteMany({
    where: { ...buildIncomingInvitationWhere(user.email, new Date()), id: invitationId },
  })

  if (count === 0) throw buildNoLongerValidError()
}

export const InvitationService = {
  listInvitations,
  createInvitation,
  revokeInvitation,
  listIncomingInvitations,
  acceptInvitation,
  declineInvitation,
}
