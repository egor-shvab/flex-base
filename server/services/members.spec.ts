import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { MemberService } from '#server/services/members'
import type { ITableAccess } from '#shared/types/workspace'
import {
  buildMembership,
  buildPermissionSetRow as setRow,
  buildRecordDefaults,
  MEMBERSHIP_WORKSPACE_ID as WORKSPACE_ID,
} from '~~/test/membership'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const MEMBER_ID = 'mem_target'
const ROLE_ID = 'rol_clerk'

const manager = buildMembership(['MEMBERS_MANAGE'], {
  recordDefaults: buildRecordDefaults({ canCreate: true, updateScope: 'ALL' }),
})

const CREATE = { canCreate: true } as const
const UPDATE = { updateScope: 'ALL' } as const
const owner = buildMembership([], { isOwner: true })

function memberRow(
  records: Partial<ITableAccess>,
  {
    id = MEMBER_ID,
    userId = 'usr_target',
    ownerId = 'usr_owner',
    permissions = setRow().permissions,
  } = {},
) {
  return {
    id,
    userId,
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    user: { id: userId, name: 'Grace', email: 'grace@example.com' },
    role: { id: 'rol_current', name: 'Current', ...setRow(permissions, records) },
    workspace: { ownerId },
  }
}

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.9.0' })

const memberWhere = { id: MEMBER_ID, workspaceId: WORKSPACE_ID }

/** The member's role as the check read it, repeated in the write. */
const guardedMemberWhere = (records: Partial<ITableAccess>) => ({
  ...memberWhere,
  roleId: 'rol_current',
  role: { permissions: { equals: [] }, ...buildRecordDefaults(records) },
})

beforeEach(() => {
  resetPrismaMock()
})

describe('MemberService.listMembers', () => {
  it('lists the workspace’s members oldest first, telling the owner by the workspace row', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValue([
      memberRow({}, { id: 'mem_owner', userId: 'usr_owner' }),
      memberRow(CREATE),
    ])

    const members = await MemberService.listMembers(WORKSPACE_ID)

    expect(members.map((member) => member.isOwner)).toEqual([true, false])
    expect(members[1]).toEqual({
      id: MEMBER_ID,
      isOwner: false,
      user: { id: 'usr_target', name: 'Grace' },
      email: 'grace@example.com',
      role: {
        id: 'rol_current',
        name: 'Current',
        permissions: [],
        recordDefaults: buildRecordDefaults(CREATE),
      },
      joinedAt: '2026-02-01T10:00:00.000Z',
    })
    expect(prismaMock.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WORKSPACE_ID },
        orderBy: { createdAt: 'asc' },
      }),
    )
  })
})

describe('MemberService.changeMemberRole', () => {
  beforeEach(() => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow(CREATE))
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow([], UPDATE))
    prismaMock.workspaceMember.update.mockResolvedValue(memberRow(UPDATE))
  })

  it('reassigns a member of the proved workspace to a role within the actor’s permissions', async () => {
    await expect(
      MemberService.changeMemberRole(manager, MEMBER_ID, ROLE_ID),
    ).resolves.toMatchObject({ id: MEMBER_ID })

    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: memberWhere }),
    )
    expect(prismaMock.workspaceRole.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_id: { workspaceId: WORKSPACE_ID, id: ROLE_ID } },
      }),
    )
    expect(prismaMock.workspaceMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: guardedMemberWhere(CREATE),
        data: { roleId: ROLE_ID },
      }),
    )
  })

  it('answers a member of another workspace as missing', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(null)

    await expect(MemberService.changeMemberRole(owner, MEMBER_ID, ROLE_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Member not found',
    })
    expect(prismaMock.workspaceMember.update).not.toHaveBeenCalled()
  })

  it.each([
    ['the owner', memberRow({}, { userId: 'usr_owner' }), owner],
    ['the actor themself', memberRow({}, { id: 'mem_actor' }), manager],
    [
      'a member whose role reaches past the actor',
      memberRow({}, { permissions: ['TABLES_MANAGE'] }),
      manager,
    ],
    ['a member who may delete what the actor cannot', memberRow({ deleteScope: 'ALL' }), manager],
  ])('refuses to touch %s before reading the role', async (_case, row, actor) => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(row)

    await expect(MemberService.changeMemberRole(actor, row.id, ROLE_ID)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.workspaceMember.update).not.toHaveBeenCalled()
  })

  it.each([
    ['a permission', setRow(['MEMBERS_INVITE'])],
    ['a record action', setRow([], { deleteScope: 'ALL' })],
  ])('refuses a role granting %s the actor lacks', async (_, row) => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(row)

    await expect(MemberService.changeMemberRole(manager, MEMBER_ID, ROLE_ID)).rejects.toMatchObject(
      { statusCode: 403 },
    )
    expect(prismaMock.workspaceMember.update).not.toHaveBeenCalled()
  })

  it('reports a member removed since the check as missing', async () => {
    prismaMock.workspaceMember.findFirst
      .mockResolvedValueOnce(memberRow(CREATE))
      .mockResolvedValueOnce(null)
    prismaMock.workspaceMember.update.mockRejectedValue(knownError('P2025'))

    await expect(MemberService.changeMemberRole(owner, MEMBER_ID, ROLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('refuses with a 409 when the member’s role changed between the check and the write', async () => {
    prismaMock.workspaceMember.findFirst
      .mockResolvedValueOnce(memberRow(CREATE))
      .mockResolvedValueOnce({ id: MEMBER_ID })
    prismaMock.workspaceMember.update.mockRejectedValue(knownError('P2025'))

    await expect(MemberService.changeMemberRole(owner, MEMBER_ID, ROLE_ID)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: expect.stringContaining('changed while your request was being handled'),
    })
  })
})

describe('MemberService.removeMember', () => {
  it('removes a member the actor may manage, within the proved workspace', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow(CREATE))
    prismaMock.workspaceMember.delete.mockResolvedValue({ id: MEMBER_ID })

    await MemberService.removeMember(manager, MEMBER_ID)

    expect(prismaMock.workspaceMember.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: guardedMemberWhere(CREATE) }),
    )
  })

  it('never removes the owner', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow({}, { userId: 'usr_owner' }))

    await expect(MemberService.removeMember(owner, MEMBER_ID)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: "You can't change or remove this member",
    })
    expect(prismaMock.workspaceMember.delete).not.toHaveBeenCalled()
  })
})
