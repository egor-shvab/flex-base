import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertPermission, requireMembership } from '#server/utils/workspace-access'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const USER_ID = 'usr_ada'
const ADDRESS = 'k3f9x2m8qa'

function memberRow(ownerId = 'usr_owner', permissions: string[] = ['RECORDS_CREATE']) {
  return {
    id: 'mem_1',
    role: { id: 'rol_1', name: 'Editor', permissions },
    workspace: {
      id: 'wsp_1',
      publicId: ADDRESS,
      name: 'Acme',
      ownerId,
      createdAt: new Date('2026-01-05T09:14:00.000Z'),
    },
  }
}

function membership(overrides: Partial<IWorkspaceMembership> = {}): IWorkspaceMembership {
  return {
    memberId: 'mem_1',
    isOwner: false,
    permissions: ['RECORDS_CREATE'],
    workspace: { id: 'wsp_1', publicId: ADDRESS, name: 'Acme', createdAt: '' },
    role: { id: 'rol_1', name: 'Editor' },
    ...overrides,
  }
}

beforeEach(resetPrismaMock)

describe('requireMembership', () => {
  it('finds the membership from the caller and the address in one query', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow())

    await requireMembership(USER_ID, ADDRESS)

    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, workspace: { publicId: ADDRESS } } }),
    )
    expect(prismaMock.workspace.findUnique).not.toHaveBeenCalled()
  })

  it('never looks a workspace up by a cuid, which is not an address', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(null)

    await expect(requireMembership(USER_ID, 'cmsesqhp60003bgtl7g0dn583')).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(prismaMock.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, workspace: { publicId: '' } } }),
    )
  })

  it('404s, never 403s, when the caller is not a member', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(null)

    await expect(requireMembership(USER_ID, ADDRESS)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Workspace not found',
      data: { missing: 'workspace' },
    })
  })

  it('reads a member’s permissions off their role', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow())

    await expect(requireMembership(USER_ID, ADDRESS)).resolves.toMatchObject({
      memberId: 'mem_1',
      isOwner: false,
      permissions: ['RECORDS_CREATE'],
      role: { id: 'rol_1', name: 'Editor' },
      workspace: { id: 'wsp_1', publicId: ADDRESS, createdAt: '2026-01-05T09:14:00.000Z' },
    })
  })

  it('gives the owner every permission, whatever their role grants', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(memberRow(USER_ID, []))

    const result = await requireMembership(USER_ID, ADDRESS)

    expect(result.isOwner).toBe(true)
    expect(result.permissions).toEqual([...WORKSPACE_PERMISSIONS])
  })
})

describe('assertPermission', () => {
  it('lets any member read', () => {
    expect(() => assertPermission(membership({ permissions: [] }), 'READ')).not.toThrow()
  })

  it('lets a member through with the permission', () => {
    expect(() => assertPermission(membership(), 'RECORDS_CREATE')).not.toThrow()
  })

  it('403s a member without it, naming what they tried', () => {
    expect(() => assertPermission(membership(), 'RECORDS_DELETE')).toThrow(
      expect.objectContaining({
        statusCode: 403,
        statusMessage: "You don't have permission to delete records",
      }),
    )
  })

  it('lets the owner through on everything', () => {
    const owner = membership({ isOwner: true, permissions: [] })

    for (const permission of WORKSPACE_PERMISSIONS) {
      expect(() => assertPermission(owner, permission)).not.toThrow()
    }
  })
})
