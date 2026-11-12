import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { InvitationService, MAX_PENDING_INVITATIONS } from '#server/services/invitations'
import type { IAuthUser } from '#shared/types/auth'
import { buildMembership, MEMBERSHIP_WORKSPACE_ID as WORKSPACE_ID } from '~~/test/membership'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const NOW = new Date('2026-03-01T12:00:00.000Z')
const IN_A_WEEK = new Date('2026-03-08T12:00:00.000Z')
const INVITATION_ID = 'inv_1'
const ROLE_ID = 'rol_clerk'

const inviter = buildMembership(['MEMBERS_INVITE', 'RECORDS_CREATE'])
const invitee: IAuthUser = { id: 'usr_grace', email: 'Grace@Example.com', name: 'Grace' }

const invitationRow = (expiresAt = IN_A_WEEK) => ({
  id: INVITATION_ID,
  email: 'grace@example.com',
  expiresAt,
  role: { id: ROLE_ID, name: 'Clerk' },
  invitedBy: { id: 'usr_ada', name: 'Ada' },
})

const membershipRow = {
  id: 'mem_grace',
  role: { id: ROLE_ID, name: 'Clerk', permissions: ['RECORDS_CREATE'] },
  workspace: {
    id: WORKSPACE_ID,
    publicId: 'k3f9x2m8qa',
    name: 'Acme',
    createdAt: new Date('2026-01-05T09:14:00.000Z'),
    ownerId: 'usr_ada',
  },
}

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.9.0' })

/** What the invitee may still accept: theirs by the lowercased email, and not expired. */
const incomingWhere = { email: 'grace@example.com', expiresAt: { gt: NOW }, id: INVITATION_ID }

beforeEach(() => {
  resetPrismaMock()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('InvitationService.listInvitations', () => {
  it('lists every invitation of the workspace, oldest first, marking the expired', async () => {
    prismaMock.workspaceInvitation.findMany.mockResolvedValue([invitationRow(), invitationRow(NOW)])

    const invitations = await InvitationService.listInvitations(WORKSPACE_ID)

    expect(invitations.map((invitation) => invitation.isExpired)).toEqual([false, true])
    expect(invitations[0]).toEqual({
      id: INVITATION_ID,
      email: 'grace@example.com',
      role: { id: ROLE_ID, name: 'Clerk' },
      invitedBy: { id: 'usr_ada', name: 'Ada' },
      expiresAt: IN_A_WEEK.toISOString(),
      isExpired: false,
    })
    expect(prismaMock.workspaceInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WORKSPACE_ID },
        orderBy: { createdAt: 'asc' },
      }),
    )
  })
})

describe('InvitationService.createInvitation', () => {
  const input = { email: 'grace@example.com', roleId: ROLE_ID }

  beforeEach(() => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: ['RECORDS_CREATE'] })
    prismaMock.workspaceMember.findFirst.mockResolvedValue(null)
    prismaMock.workspaceInvitation.count.mockResolvedValue(0)
    prismaMock.workspaceInvitation.upsert.mockResolvedValue(invitationRow())
  })

  it('invites the address for a week, or renews the invitation it already has', async () => {
    await expect(
      InvitationService.createInvitation(inviter, 'usr_ada', input),
    ).resolves.toMatchObject({ id: INVITATION_ID, isExpired: false })

    const renewal = { roleId: ROLE_ID, invitedById: 'usr_ada', expiresAt: IN_A_WEEK }
    expect(prismaMock.workspaceInvitation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_email: { workspaceId: WORKSPACE_ID, email: 'grace@example.com' } },
        create: { workspaceId: WORKSPACE_ID, email: 'grace@example.com', ...renewal },
        update: renewal,
      }),
    )
  })

  it('refuses a role granting more than the inviter holds, before anything else', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: ['TABLES_MANAGE'] })

    await expect(
      InvitationService.createInvitation(inviter, 'usr_ada', input),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.workspaceMember.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.workspaceInvitation.upsert).not.toHaveBeenCalled()
  })

  it('refuses someone already in the workspace, whatever the case of their email', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue({ id: 'mem_grace' })

    await expect(
      InvitationService.createInvitation(inviter, 'usr_ada', input),
    ).rejects.toMatchObject({ statusCode: 409, statusMessage: 'This person is already a member' })
    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: WORKSPACE_ID,
          user: { email: { equals: 'grace@example.com', mode: 'insensitive' } },
        },
      }),
    )
    expect(prismaMock.workspaceInvitation.upsert).not.toHaveBeenCalled()
  })

  it('caps the pending invitations, not counting the one being renewed or the expired', async () => {
    prismaMock.workspaceInvitation.count.mockResolvedValue(MAX_PENDING_INVITATIONS)

    await expect(
      InvitationService.createInvitation(inviter, 'usr_ada', input),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(prismaMock.workspaceInvitation.count).toHaveBeenCalledWith({
      where: {
        workspaceId: WORKSPACE_ID,
        email: { not: 'grace@example.com' },
        expiresAt: { gt: NOW },
      },
    })
    expect(prismaMock.workspaceInvitation.upsert).not.toHaveBeenCalled()
  })
})

describe('InvitationService.revokeInvitation', () => {
  it('deletes only an invitation of the proved workspace', async () => {
    prismaMock.workspaceInvitation.delete.mockResolvedValue({ id: INVITATION_ID })

    await InvitationService.revokeInvitation(WORKSPACE_ID, INVITATION_ID)

    expect(prismaMock.workspaceInvitation.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INVITATION_ID, workspaceId: WORKSPACE_ID } }),
    )
  })

  it('answers one already gone as missing', async () => {
    prismaMock.workspaceInvitation.delete.mockRejectedValue(knownError('P2025'))

    await expect(
      InvitationService.revokeInvitation(WORKSPACE_ID, INVITATION_ID),
    ).rejects.toMatchObject({ statusCode: 404, statusMessage: 'Invitation not found' })
  })
})

describe('InvitationService.listIncomingInvitations', () => {
  it('finds the open invitations by the caller’s email, lowercased to match', async () => {
    prismaMock.workspaceInvitation.findMany.mockResolvedValue([
      {
        id: INVITATION_ID,
        expiresAt: IN_A_WEEK,
        workspace: { name: 'Acme' },
        role: { name: 'Clerk' },
        invitedBy: null,
      },
    ])

    await expect(InvitationService.listIncomingInvitations(invitee)).resolves.toEqual([
      {
        id: INVITATION_ID,
        workspace: { name: 'Acme' },
        role: { name: 'Clerk' },
        invitedBy: null,
        expiresAt: IN_A_WEEK.toISOString(),
      },
    ])
    expect(prismaMock.workspaceInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'grace@example.com', expiresAt: { gt: NOW } },
      }),
    )
  })
})

describe('InvitationService.acceptInvitation', () => {
  beforeEach(() => {
    prismaMock.workspaceInvitation.findFirst.mockResolvedValue({
      workspaceId: WORKSPACE_ID,
      roleId: ROLE_ID,
    })
    prismaMock.workspaceInvitation.delete.mockResolvedValue({ id: INVITATION_ID })
    prismaMock.workspaceMember.create.mockResolvedValue(membershipRow)
  })

  it('turns the invitation into a membership under its role, in one transaction', async () => {
    await expect(InvitationService.acceptInvitation(invitee, INVITATION_ID)).resolves.toMatchObject(
      {
        memberId: 'mem_grace',
        isOwner: false,
        permissions: ['RECORDS_CREATE'],
      },
    )

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspaceInvitation.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: incomingWhere }),
    )
    expect(prismaMock.workspaceMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { workspaceId: WORKSPACE_ID, userId: 'usr_grace', roleId: ROLE_ID },
      }),
    )
  })

  it('refuses an invitation addressed elsewhere or expired, without writing', async () => {
    prismaMock.workspaceInvitation.findFirst.mockResolvedValue(null)

    await expect(InvitationService.acceptInvitation(invitee, INVITATION_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'This invitation is no longer valid',
    })
    expect(prismaMock.workspaceInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: incomingWhere }),
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('answers an accept that lost the race with the same 404', async () => {
    prismaMock.workspaceInvitation.delete.mockRejectedValue(knownError('P2025'))

    await expect(InvitationService.acceptInvitation(invitee, INVITATION_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(prismaMock.workspaceMember.create).not.toHaveBeenCalled()
  })

  it('drops the invitation of someone already a member and returns their membership', async () => {
    prismaMock.workspaceMember.create.mockRejectedValue(knownError('P2002'))
    prismaMock.workspaceInvitation.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.workspaceMember.findFirstOrThrow.mockResolvedValue(membershipRow)

    await expect(InvitationService.acceptInvitation(invitee, INVITATION_ID)).resolves.toMatchObject(
      {
        memberId: 'mem_grace',
      },
    )
    expect(prismaMock.workspaceInvitation.deleteMany).toHaveBeenCalledWith({
      where: { id: INVITATION_ID },
    })
    expect(prismaMock.workspaceMember.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: WORKSPACE_ID, userId: 'usr_grace' } }),
    )
  })
})

describe('InvitationService.declineInvitation', () => {
  it('deletes only an invitation still open to the caller', async () => {
    prismaMock.workspaceInvitation.deleteMany.mockResolvedValue({ count: 1 })

    await InvitationService.declineInvitation(invitee, INVITATION_ID)

    expect(prismaMock.workspaceInvitation.deleteMany).toHaveBeenCalledWith({ where: incomingWhere })
  })

  it('answers one that is gone as no longer valid', async () => {
    prismaMock.workspaceInvitation.deleteMany.mockResolvedValue({ count: 0 })

    await expect(InvitationService.declineInvitation(invitee, INVITATION_ID)).rejects.toMatchObject(
      { statusCode: 404, statusMessage: 'This invitation is no longer valid' },
    )
  })
})
