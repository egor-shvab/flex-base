import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { dropFieldIndexes, listIndexedFieldIds } from '#server/db/field-indexes'
import { WorkspaceService } from '#server/services/workspaces'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import { buildMembership } from '~~/test/membership'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

vi.mock('#server/db/field-indexes', () => ({
  dropFieldIndexes: vi.fn(),
  listIndexedFieldIds: vi.fn(),
}))

const USER_ID = 'usr_1'
const WORKSPACE_ID = 'wsp_1'

const workspaceRow = {
  id: WORKSPACE_ID,
  publicId: 'k3f9x2m8qa',
  name: 'Acme',
  createdAt: new Date('2026-01-05T09:14:00.000Z'),
}

const knownError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.9.0', meta })

const publicIdCollision = () =>
  knownError('P2002', {
    driverAdapterError: { cause: { constraint: { fields: ['"publicId"'] } } },
  })

beforeEach(() => {
  resetPrismaMock()
})

describe('WorkspaceService.createWorkspace', () => {
  beforeEach(() => {
    prismaMock.workspace.create.mockResolvedValue({ id: WORKSPACE_ID })
    prismaMock.workspaceMember.create.mockResolvedValue({
      id: 'mem_1',
      role: { id: 'rol_1', name: 'Admin', permissions: [...WORKSPACE_PERMISSIONS] },
      workspace: { ...workspaceRow, ownerId: USER_ID },
    })
  })

  it('makes the caller its owner, under the default roles, in one transaction', async () => {
    const membership = await WorkspaceService.createWorkspace(USER_ID, 'Acme')

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Acme',
          ownerId: USER_ID,
          roles: { create: expect.arrayContaining([expect.objectContaining({ name: 'Admin' })]) },
        }),
      }),
    )
    expect(membership).toMatchObject({
      memberId: 'mem_1',
      isOwner: true,
      role: { name: 'Admin' },
      workspace: { id: WORKSPACE_ID, publicId: 'k3f9x2m8qa', name: 'Acme' },
    })
  })

  it('reruns the transaction when the public id collides', async () => {
    prismaMock.workspace.create.mockRejectedValueOnce(publicIdCollision())

    await expect(WorkspaceService.createWorkspace(USER_ID, 'Acme')).resolves.toMatchObject({
      isOwner: true,
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
  })
})

describe('WorkspaceService.renameWorkspace', () => {
  it('writes the workspace the membership proved, by its id', async () => {
    prismaMock.workspace.update.mockResolvedValue({ ...workspaceRow, name: 'Renamed' })

    await expect(WorkspaceService.renameWorkspace(WORKSPACE_ID, 'Renamed')).resolves.toEqual({
      ...workspaceRow,
      name: 'Renamed',
      createdAt: '2026-01-05T09:14:00.000Z',
    })
    expect(prismaMock.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WORKSPACE_ID }, data: { name: 'Renamed' } }),
    )
  })

  it('reports a workspace deleted since the check as missing, never as a table', async () => {
    prismaMock.workspace.update.mockRejectedValue(knownError('P2025'))

    await expect(WorkspaceService.renameWorkspace(WORKSPACE_ID, 'Renamed')).rejects.toMatchObject({
      statusCode: 404,
      data: { missing: 'workspace' },
    })
  })
})

describe('WorkspaceService.deleteWorkspace', () => {
  beforeEach(() => {
    vi.mocked(listIndexedFieldIds).mockReset().mockResolvedValue([])
    vi.mocked(dropFieldIndexes).mockReset().mockResolvedValue()
  })

  it('drops the indexes of every field in it, read before the cascade', async () => {
    prismaMock.workspace.delete.mockResolvedValue({ id: WORKSPACE_ID })
    vi.mocked(listIndexedFieldIds).mockResolvedValue(['fld_1'])

    await WorkspaceService.deleteWorkspace(WORKSPACE_ID)

    expect(listIndexedFieldIds).toHaveBeenCalledWith({ table: { workspaceId: WORKSPACE_ID } })
    expect(dropFieldIndexes).toHaveBeenCalledWith(['fld_1'])
  })

  it('drops no index when the delete fails', async () => {
    prismaMock.workspace.delete.mockRejectedValue(knownError('P2025'))
    vi.mocked(listIndexedFieldIds).mockResolvedValue(['fld_1'])

    await expect(WorkspaceService.deleteWorkspace(WORKSPACE_ID)).rejects.toThrow()

    expect(dropFieldIndexes).not.toHaveBeenCalled()
  })

  it('deletes by the proved id alone, leaving the rest to the cascade', async () => {
    prismaMock.workspace.delete.mockResolvedValue({ id: WORKSPACE_ID })

    await WorkspaceService.deleteWorkspace(WORKSPACE_ID)

    expect(prismaMock.workspace.delete).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspace.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WORKSPACE_ID } }),
    )
  })

  it('reports a workspace already gone as missing', async () => {
    prismaMock.workspace.delete.mockRejectedValue(knownError('P2025'))

    await expect(WorkspaceService.deleteWorkspace(WORKSPACE_ID)).rejects.toMatchObject({
      statusCode: 404,
      data: { missing: 'workspace' },
    })
  })

  it('passes any other failure through, so it still surfaces as a 500', async () => {
    const failure = new Error('connection lost')
    prismaMock.workspace.delete.mockRejectedValue(failure)

    await expect(WorkspaceService.deleteWorkspace(WORKSPACE_ID)).rejects.toBe(failure)
  })
})

describe('WorkspaceService.transferOwnership', () => {
  const owner = buildMembership([], { isOwner: true, memberId: 'mem_owner' })

  beforeEach(() => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue({
      id: 'mem_grace',
      userId: 'usr_grace',
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
      user: { id: 'usr_grace', name: 'Grace', email: 'grace@example.com' },
      role: { id: 'rol_editor', name: 'Editor', permissions: [] },
      workspace: { ownerId: USER_ID },
    })
    prismaMock.workspace.update.mockResolvedValue({ id: WORKSPACE_ID })
  })

  it('hands the workspace to a member, only while they still are one', async () => {
    await WorkspaceService.transferOwnership(owner, 'mem_grace')

    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mem_grace', workspaceId: WORKSPACE_ID } }),
    )
    expect(prismaMock.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WORKSPACE_ID, members: { some: { id: 'mem_grace' } } },
        data: { ownerId: 'usr_grace' },
      }),
    )
  })

  it('refuses to hand it to the owner themself', async () => {
    await expect(WorkspaceService.transferOwnership(owner, 'mem_owner')).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(prismaMock.workspace.update).not.toHaveBeenCalled()
  })

  it('answers a member of another workspace, or one removed since the read, as missing', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValueOnce(null)
    await expect(WorkspaceService.transferOwnership(owner, 'mem_grace')).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Member not found',
    })

    prismaMock.workspace.update.mockRejectedValue(knownError('P2025'))
    await expect(WorkspaceService.transferOwnership(owner, 'mem_grace')).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Member not found',
    })
  })
})

describe('WorkspaceService.leaveWorkspace', () => {
  it('ends the caller’s own membership', async () => {
    prismaMock.workspaceMember.delete.mockResolvedValue({ id: 'mem_actor' })

    await WorkspaceService.leaveWorkspace(buildMembership(['RECORDS_CREATE']))

    expect(prismaMock.workspaceMember.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mem_actor' } }),
    )
  })

  it('keeps the owner, who must hand the workspace over first', async () => {
    await expect(
      WorkspaceService.leaveWorkspace(buildMembership([], { isOwner: true })),
    ).rejects.toMatchObject({ statusCode: 409, statusMessage: 'Transfer ownership before leaving' })
    expect(prismaMock.workspaceMember.delete).not.toHaveBeenCalled()
  })

  it('reports a membership already gone as the workspace’s 404', async () => {
    prismaMock.workspaceMember.delete.mockRejectedValue(knownError('P2025'))

    await expect(
      WorkspaceService.leaveWorkspace(buildMembership(['RECORDS_CREATE'])),
    ).rejects.toMatchObject({ statusCode: 404, data: { missing: 'workspace' } })
  })
})

describe('WorkspaceService.setLastWorkspace', () => {
  it('writes only the caller’s own row', async () => {
    prismaMock.user.update.mockResolvedValue({ id: USER_ID })

    await WorkspaceService.setLastWorkspace(USER_ID, WORKSPACE_ID)

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID }, data: { lastWorkspaceId: WORKSPACE_ID } }),
    )
  })
})
