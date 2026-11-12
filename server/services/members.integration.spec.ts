import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '#server/db/prisma'
import { MemberService } from '#server/services/members'
import { WorkspaceService } from '#server/services/workspaces'
import { requireMembership } from '#server/utils/workspace-access'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import {
  addMember,
  createRecord,
  createTable,
  createUser,
  type TSeededUser,
} from '~~/test/integration/seed'

let ada: TSeededUser
let grace: TSeededUser
let owner: IWorkspaceMembership
let graceMemberId: string

beforeEach(async () => {
  ada = await createUser('ada@example.com')
  grace = await createUser('grace@example.com')
  owner = await requireMembership(ada.id, ada.workspace.publicId)
  graceMemberId = (await addMember(ada.workspace.id, grace.id, 'Editor')).id
})

const findRoleId = async (name: string) =>
  (
    await prisma.workspaceRole.findUniqueOrThrow({
      where: { workspaceId_name: { workspaceId: ada.workspace.id, name } },
      select: { id: true },
    })
  ).id

describe('the members of a workspace', () => {
  it('lists everyone with their role and email, the owner marked', async () => {
    const members = await MemberService.listMembers(ada.workspace.id)

    expect(members).toEqual([
      expect.objectContaining({
        isOwner: true,
        email: 'ada@example.com',
        role: expect.objectContaining({ name: 'Admin' }),
      }),
      expect.objectContaining({
        isOwner: false,
        email: 'grace@example.com',
        role: expect.objectContaining({ name: 'Editor' }),
      }),
    ])
  })

  it('change role, and the member’s next request carries it', async () => {
    await MemberService.changeMemberRole(owner, graceMemberId, await findRoleId('Viewer'))

    await expect(requireMembership(grace.id, ada.workspace.publicId)).resolves.toMatchObject({
      role: { name: 'Viewer' },
      permissions: [],
    })
  })

  it('cannot be given a role of another workspace', async () => {
    const foreignRoleId = (
      await prisma.workspaceRole.findUniqueOrThrow({
        where: { workspaceId_name: { workspaceId: grace.workspace.id, name: 'Admin' } },
        select: { id: true },
      })
    ).id

    await expect(
      MemberService.changeMemberRole(owner, graceMemberId, foreignRoleId),
    ).rejects.toMatchObject({ statusCode: 404, statusMessage: 'Role not found' })
  })

  it('lose access on their next request once removed, leaving their records behind', async () => {
    const table = await createTable(ada.workspace.id)
    const record = await createRecord(table.id)
    await prisma.record.update({ where: { id: record.id }, data: { createdById: grace.id } })

    await MemberService.removeMember(owner, graceMemberId)

    await expect(requireMembership(grace.id, ada.workspace.publicId)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(
      prisma.record.findUniqueOrThrow({ where: { id: record.id }, select: { createdById: true } }),
    ).resolves.toEqual({ createdById: grace.id })
  })
})

describe('handing a workspace over', () => {
  it('makes the member its owner and keeps the old owner a member under their role', async () => {
    await WorkspaceService.transferOwnership(owner, graceMemberId)

    await expect(requireMembership(grace.id, ada.workspace.publicId)).resolves.toMatchObject({
      isOwner: true,
    })
    await expect(requireMembership(ada.id, ada.workspace.publicId)).resolves.toMatchObject({
      isOwner: false,
      role: { name: 'Admin' },
    })
  })

  it('lets the old owner leave, and keeps the new one from it', async () => {
    await WorkspaceService.transferOwnership(owner, graceMemberId)

    await WorkspaceService.leaveWorkspace(await requireMembership(ada.id, ada.workspace.publicId))
    await expect(
      WorkspaceService.leaveWorkspace(await requireMembership(grace.id, ada.workspace.publicId)),
    ).rejects.toMatchObject({ statusCode: 409 })

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: ada.workspace.id },
      select: { ownerId: true, members: { select: { userId: true } } },
    })
    expect(workspace).toEqual({ ownerId: grace.id, members: [{ userId: grace.id }] })
  })

  it('refuses a member of another workspace', async () => {
    const mallory = await createUser('mallory@example.com')
    const malloryMemberId = (
      await prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId: mallory.workspace.id },
        select: { id: true },
      })
    ).id

    await expect(WorkspaceService.transferOwnership(owner, malloryMemberId)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(
      prisma.workspace.findUniqueOrThrow({
        where: { id: ada.workspace.id },
        select: { ownerId: true },
      }),
    ).resolves.toEqual({ ownerId: ada.id })
  })
})
