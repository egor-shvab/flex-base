import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { memberSelect, toSharedMember, type TMemberRow } from '#server/db/workspaces'
import { RoleService } from '#server/services/roles'
import { toHttpError } from '#server/utils/http-errors'
import type { IWorkspaceMember, IWorkspaceMembership } from '#shared/types/workspace'
import { canManageMember } from '#shared/utils/permissions'

const memberErrors = { notFound: 'Member not found' }

async function listMembers(workspaceId: string): Promise<IWorkspaceMember[]> {
  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    select: memberSelect,
  })

  return rows.map(toSharedMember)
}

/** Within the workspace, so a member id from another one is a 404 like any missing member. */
async function getMember(workspaceId: string, memberId: string): Promise<TMemberRow> {
  const row = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    select: memberSelect,
  })

  if (!row) throw createError({ statusCode: 404, statusMessage: memberErrors.notFound })

  return row
}

/** The owner, the actor themself, or a member whose role reaches past the actor's permissions. */
async function getManagedMember(
  actor: IWorkspaceMembership,
  memberId: string,
): Promise<TMemberRow> {
  const row = await getMember(actor.workspace.id, memberId)

  if (!canManageMember(actor, toSharedMember(row))) {
    throw createError({ statusCode: 403, statusMessage: "You can't change or remove this member" })
  }

  return row
}

async function changeMemberRole(
  actor: IWorkspaceMembership,
  memberId: string,
  roleId: string,
): Promise<IWorkspaceMember> {
  await getManagedMember(actor, memberId)
  await RoleService.requireAssignableRole(actor, roleId)

  try {
    return toSharedMember(
      await prisma.workspaceMember.update({
        where: { id: memberId, workspaceId: actor.workspace.id },
        data: { roleId },
        select: memberSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, memberErrors)
  }
}

async function removeMember(actor: IWorkspaceMembership, memberId: string): Promise<void> {
  await getManagedMember(actor, memberId)

  try {
    await prisma.workspaceMember.delete({
      where: { id: memberId, workspaceId: actor.workspace.id },
      select: { id: true },
    })
  } catch (error) {
    throw toHttpError(error, memberErrors)
  }
}

export const MemberService = {
  listMembers,
  getMember,
  changeMemberRole,
  removeMember,
}
