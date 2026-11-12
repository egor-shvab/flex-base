import type { Prisma } from '#server/generated/prisma/client'
import { toUserRef, userRefSelect } from '#server/db/users'
import type { IIncomingInvitation, IWorkspaceInvitation } from '#shared/types/workspace'

export const invitationSelect = {
  id: true,
  email: true,
  expiresAt: true,
  role: { select: { id: true, name: true } },
  invitedBy: { select: userRefSelect },
} satisfies Prisma.WorkspaceInvitationSelect

export const incomingInvitationSelect = {
  id: true,
  expiresAt: true,
  workspace: { select: { name: true } },
  role: { select: { name: true } },
  invitedBy: { select: userRefSelect },
} satisfies Prisma.WorkspaceInvitationSelect

export type TInvitationRow = Prisma.WorkspaceInvitationGetPayload<{
  select: typeof invitationSelect
}>
export type TIncomingInvitationRow = Prisma.WorkspaceInvitationGetPayload<{
  select: typeof incomingInvitationSelect
}>

/** Invitations are stored lowercased; a user's email is matched the same way. */
export function toInvitationEmail(email: string): string {
  return email.toLowerCase()
}

/** An invitation still open to `email`: addressed to it and not expired at `now`. */
export function buildIncomingInvitationWhere(
  email: string,
  now: Date,
): Prisma.WorkspaceInvitationWhereInput {
  return { email: toInvitationEmail(email), expiresAt: { gt: now } }
}

export function toSharedInvitation(row: TInvitationRow, now: Date): IWorkspaceInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    invitedBy: toUserRef(row.invitedBy),
    expiresAt: row.expiresAt.toISOString(),
    isExpired: row.expiresAt <= now,
  }
}

export function toIncomingInvitation(row: TIncomingInvitationRow): IIncomingInvitation {
  return {
    id: row.id,
    workspace: row.workspace,
    role: row.role,
    invitedBy: toUserRef(row.invitedBy),
    expiresAt: row.expiresAt.toISOString(),
  }
}
