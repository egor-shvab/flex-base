import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { memberSelect, toSharedMember, type TMemberRow } from '#server/db/workspaces'
import { RoleService } from '#server/services/roles'
import { isMissingRow } from '#server/db/prisma-errors'
import { buildChangedMeanwhileError, toHttpError } from '#server/utils/http-errors'
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

/**
 * The decision rests on the member's role as read, so the write repeats it: the same role with the
 * same permissions, or nothing is written. Without it, a member raised past the actor's reach in
 * between could still be changed or removed by them.
 */
function buildManagedMemberWhere(actor: IWorkspaceMembership, row: TMemberRow) {
  return {
    id: row.id,
    workspaceId: actor.workspace.id,
    roleId: row.role.id,
    role: { permissions: { equals: row.role.permissions } },
  }
}

async function toMemberWriteError(error: unknown, actor: IWorkspaceMembership, memberId: string) {
  if (isMissingRow(error)) {
    const current = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: actor.workspace.id },
      select: { id: true },
    })
    if (current) return buildChangedMeanwhileError('member')
  }
  return toHttpError(error, memberErrors)
}

/**
 * The new role is checked, not repeated in the write: widening it meanwhile takes someone allowed
 * to, so the member ends with what that person set, never more than the actor could grant.
 */
async function changeMemberRole(
  actor: IWorkspaceMembership,
  memberId: string,
  roleId: string,
): Promise<IWorkspaceMember> {
  const row = await getManagedMember(actor, memberId)
  await RoleService.requireAssignableRole(actor, roleId)

  try {
    return toSharedMember(
      await prisma.workspaceMember.update({
        where: buildManagedMemberWhere(actor, row),
        data: { roleId },
        select: memberSelect,
      }),
    )
  } catch (error) {
    throw await toMemberWriteError(error, actor, memberId)
  }
}

async function removeMember(actor: IWorkspaceMembership, memberId: string): Promise<void> {
  const row = await getManagedMember(actor, memberId)

  try {
    await prisma.workspaceMember.delete({
      where: buildManagedMemberWhere(actor, row),
      select: { id: true },
    })
  } catch (error) {
    throw await toMemberWriteError(error, actor, memberId)
  }
}

export const MemberService = {
  listMembers,
  getMember,
  changeMemberRole,
  removeMember,
}
