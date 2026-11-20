import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { MemberService } from '#server/services/members'
import {
  buildMembership,
  buildPermissionSetRow as setRow,
  MEMBERSHIP_WORKSPACE_ID as WORKSPACE_ID,
} from '~~/test/membership'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

/** The role comparison has its own spec; here only what the member service does with it. */
const roleService = vi.hoisted(() => ({ getRoleReach: vi.fn(), requireAssignableRole: vi.fn() }))
vi.mock('#server/services/roles', () => ({ RoleService: roleService }))

const MEMBER_ID = 'mem_target'
const ROLE_ID = 'rol_clerk'

const manager = buildMembership(['MEMBERS_MANAGE'])

const ROLE_READ_AT = new Date('2026-02-11T16:30:00.000Z')
const owner = buildMembership([], { isOwner: true })

function memberRow({
  id = MEMBER_ID,
  userId = 'usr_target',
  ownerId = 'usr_owner',
  permissions = setRow().permissions,
} = {}) {
  return {
    id,
    userId,
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    user: { id: userId, name: 'Grace', email: 'grace@example.com' },
    role: { id: 'rol_current', name: 'Current', ...setRow(permissions) },
    workspace: { ownerId },
  }
}

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.9.0' })

const memberWhere = { id: MEMBER_ID, workspaceId: WORKSPACE_ID }

/** The member's role at the version the check read, repeated in the write. */
const guardedMemberWhere = {
  ...memberWhere,
  roleId: 'rol_current',
  role: { updatedAt: ROLE_READ_AT },
}

beforeEach(() => {
  resetPrismaMock()
  roleService.getRoleReach.mockReset().mockResolvedValue({
    isWithinActor: true,
    updatedAt: ROLE_READ_AT,
  })
  roleService.requireAssignableRole.mockReset().mockResolvedValue(undefined)
})

describe('MemberService.listMembers', () => {
  it('lists the workspace’s members oldest first, telling the owner by the workspace row', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValue([
      memberRow({ id: 'mem_owner', userId: 'usr_owner' }),
      memberRow(),
    ])

    const members = await MemberService.listMembers(manager)

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

describe('MemberService.listMembers, to a member who may not see roles', () => {
  it('leaves out every role and who owns the workspace, their own membership included', async () => {
    const reader = buildMembership([], { memberId: 'mem_reader' })
    prismaMock.workspaceMember.findMany.mockResolvedValue([
      memberRow({ id: 'mem_owner', userId: 'usr_owner' }),
      memberRow({ id: 'mem_reader', userId: 'usr_reader' }),
      memberRow(),
    ])

    const members = await MemberService.listMembers(reader)

    expect(members.map(({ isOwner, role }) => ({ isOwner, role }))).toEqual([
      { isOwner: false, role: null },
      { isOwner: false, role: null },
      { isOwner: false, role: null },
    ])
  })
})

describe('MemberService.changeMemberRole', () => {
  beforeEach(() => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow())
    prismaMock.workspaceMember.update.mockResolvedValue(memberRow())
  })

  it('reassigns a member of the proved workspace to a role within the actor’s reach', async () => {
    await expect(
      MemberService.changeMemberRole(manager, MEMBER_ID, ROLE_ID),
    ).resolves.toMatchObject({ id: MEMBER_ID })

    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: memberWhere }),
    )
    expect(roleService.getRoleReach).toHaveBeenCalledWith(manager, 'rol_current')
    expect(roleService.requireAssignableRole).toHaveBeenCalledWith(manager, ROLE_ID)
    expect(prismaMock.workspaceMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: guardedMemberWhere, data: { roleId: ROLE_ID } }),
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
    ['the owner', memberRow({ userId: 'usr_owner' }), owner, true],
    ['the actor themself', memberRow({ id: 'mem_actor' }), manager, true],
    ['a member whose role reaches past the actor', memberRow(), manager, false],
  ])(
    'refuses to touch %s before the new role is asked about',
    async (_case, row, actor, isWithin) => {
      prismaMock.workspaceMember.findFirst.mockResolvedValue(row)
      roleService.getRoleReach.mockResolvedValue({
        isWithinActor: isWithin,
        updatedAt: ROLE_READ_AT,
      })

      await expect(MemberService.changeMemberRole(actor, row.id, ROLE_ID)).rejects.toMatchObject({
        statusCode: 403,
      })
      expect(roleService.requireAssignableRole).not.toHaveBeenCalled()
      expect(prismaMock.workspaceMember.update).not.toHaveBeenCalled()
    },
  )

  it('refuses a new role beyond the actor, writing nothing', async () => {
    roleService.requireAssignableRole.mockRejectedValue({ statusCode: 403 })

    await expect(MemberService.changeMemberRole(manager, MEMBER_ID, ROLE_ID)).rejects.toMatchObject(
      { statusCode: 403 },
    )
    expect(prismaMock.workspaceMember.update).not.toHaveBeenCalled()
  })

  it('reports a member removed since the check as missing', async () => {
    prismaMock.workspaceMember.findFirst
      .mockResolvedValueOnce(memberRow())
      .mockResolvedValueOnce(null)
    prismaMock.workspaceMember.update.mockRejectedValue(knownError('P2025'))

    await expect(MemberService.changeMemberRole(owner, MEMBER_ID, ROLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('refuses with a 409 when the member’s role changed between the check and the write', async () => {
    prismaMock.workspaceMember.findFirst
      .mockResolvedValueOnce(memberRow())
      .mockResolvedValueOnce({ id: MEMBER_ID })
    prismaMock.workspaceMember.update.mockRejectedValue(knownError('P2025'))

    await expect(MemberService.changeMemberRole(owner, MEMBER_ID, ROLE_ID)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: expect.stringContaining('changed while your request was being handled'),
    })
  })
})

describe('MemberService.removeMember', () => {
  it('removes a member the actor may manage, at their role’s version as read', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow())
    prismaMock.workspaceMember.delete.mockResolvedValue({ id: MEMBER_ID })

    await MemberService.removeMember(manager, MEMBER_ID)

    expect(prismaMock.workspaceMember.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: guardedMemberWhere }),
    )
  })

  it('never removes the owner', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow({ userId: 'usr_owner' }))

    await expect(MemberService.removeMember(owner, MEMBER_ID)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: "You can't change or remove this member",
    })
    expect(prismaMock.workspaceMember.delete).not.toHaveBeenCalled()
  })
})
