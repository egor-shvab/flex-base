import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '#server/db/prisma'
import { InvitationService } from '#server/services/invitations'
import { RoleService } from '#server/services/roles'
import { WorkspaceService } from '#server/services/workspaces'
import { requireMembership } from '#server/utils/workspace-access'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import { createUser, type TSeededUser } from '~~/test/integration/seed'

let ada: TSeededUser
let owner: IWorkspaceMembership
let grace: TSeededUser
let editorRoleId: string

beforeEach(async () => {
  ada = await createUser('ada@example.com')
  owner = (await WorkspaceService.listMemberships(ada.id)).memberships[0]!
  grace = await createUser('Grace@Example.com')
  editorRoleId = (
    await prisma.workspaceRole.findUniqueOrThrow({
      where: { workspaceId_name: { workspaceId: ada.workspace.id, name: 'Editor' } },
      select: { id: true },
    })
  ).id
})

const invite = (email = 'grace@example.com') =>
  InvitationService.createInvitation(owner, ada.id, { email, roleId: editorRoleId })

describe('an invitation', () => {
  it('reaches its address whatever the case it registered with, and joins them on accept', async () => {
    const invitation = await invite()

    const incoming = await InvitationService.listIncomingInvitations(grace)
    expect(incoming).toEqual([
      expect.objectContaining({
        id: invitation.id,
        workspace: { name: owner.workspace.name },
        role: { name: 'Editor' },
        invitedBy: { id: ada.id, name: ada.name },
      }),
    ])

    const membership = await InvitationService.acceptInvitation(grace, invitation.id)

    expect(membership).toMatchObject({ isOwner: false, role: { name: 'Editor' } })
    await expect(requireMembership(grace.id, ada.workspace.publicId)).resolves.toMatchObject({
      memberId: membership.memberId,
    })
    await expect(InvitationService.listInvitations(ada.workspace.id)).resolves.toEqual([])
  })

  it('is renewed, not duplicated, when sent again', async () => {
    const first = await invite()
    const again = await invite('GRACE@example.com')

    expect(again.id).toBe(first.id)
    await expect(prisma.workspaceInvitation.count()).resolves.toBe(1)
  })

  it('cannot be accepted by anyone else', async () => {
    const mallory = await createUser('mallory@example.com')
    const invitation = await invite()

    await expect(InvitationService.acceptInvitation(mallory, invitation.id)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(InvitationService.declineInvitation(mallory, invitation.id)).rejects.toMatchObject(
      { statusCode: 404 },
    )
    await expect(prisma.workspaceInvitation.count()).resolves.toBe(1)
  })

  it('cannot be accepted once expired, and no longer shows as incoming', async () => {
    const invitation = await invite()
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    await expect(InvitationService.listIncomingInvitations(grace)).resolves.toEqual([])
    await expect(InvitationService.acceptInvitation(grace, invitation.id)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'This invitation is no longer valid',
    })
    await expect(InvitationService.listInvitations(ada.workspace.id)).resolves.toEqual([
      expect.objectContaining({ id: invitation.id, isExpired: true }),
    ])
  })

  it('creates one membership when accepted twice at once', async () => {
    const invitation = await invite()

    const outcomes = await Promise.allSettled([
      InvitationService.acceptInvitation(grace, invitation.id),
      InvitationService.acceptInvitation(grace, invitation.id),
    ])

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled').length).toBeGreaterThan(0)
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') expect(outcome.reason).toMatchObject({ statusCode: 404 })
    }
    await expect(
      prisma.workspaceMember.count({ where: { workspaceId: ada.workspace.id, userId: grace.id } }),
    ).resolves.toBe(1)
    await expect(prisma.workspaceInvitation.count()).resolves.toBe(0)
  })

  it('is refused for someone already a member', async () => {
    await InvitationService.acceptInvitation(grace, (await invite()).id)

    await expect(invite()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('keeps its role from being deleted until it is revoked', async () => {
    const invitation = await invite()

    await expect(RoleService.deleteRole(owner, editorRoleId)).rejects.toMatchObject({
      statusCode: 409,
    })

    await InvitationService.revokeInvitation(ada.workspace.id, invitation.id)
    await expect(RoleService.deleteRole(owner, editorRoleId)).resolves.toBeUndefined()
  })

  it('goes with its workspace', async () => {
    await invite()

    await WorkspaceService.deleteWorkspace(ada.workspace.id)

    await expect(prisma.workspaceInvitation.count()).resolves.toBe(0)
  })

  it('can only be revoked from its own workspace', async () => {
    const invitation = await invite()

    await expect(
      InvitationService.revokeInvitation(grace.workspace.id, invitation.id),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(prisma.workspaceInvitation.count()).resolves.toBe(1)
  })
})
