import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { MAX_WORKSPACE_ROLES, RoleService } from '#server/services/roles'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { IWorkspaceMembership, TWorkspacePermission } from '#shared/types/workspace'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const WORKSPACE_ID = 'wsp_1'
const ROLE_ID = 'rol_1'

function buildActor(permissions: TWorkspacePermission[], isOwner = false): IWorkspaceMembership {
  return {
    memberId: 'mem_1',
    isOwner,
    permissions: isOwner ? [...WORKSPACE_PERMISSIONS] : permissions,
    role: { id: 'rol_actor', name: 'Manager' },
    workspace: {
      id: WORKSPACE_ID,
      publicId: 'k3f9x2m8qa',
      name: 'Acme',
      createdAt: '2026-01-05T09:14:00.000Z',
    },
  }
}

const manager = buildActor(['ROLES_MANAGE', 'RECORDS_CREATE', 'RECORDS_UPDATE'])
const owner = buildActor([], true)

const roleRow = (permissions: TWorkspacePermission[], memberCount = 0) => ({
  id: ROLE_ID,
  name: 'Clerk',
  permissions,
  _count: { members: memberCount },
})

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '7.9.0' })

const roleWhere = { workspaceId_id: { workspaceId: WORKSPACE_ID, id: ROLE_ID } }

beforeEach(() => {
  resetPrismaMock()
})

describe('RoleService.listRoles', () => {
  it('reads this workspace’s roles in a stable order, with how many members hold each', async () => {
    prismaMock.workspaceRole.findMany.mockResolvedValue([roleRow(['RECORDS_CREATE'], 3)])

    await expect(RoleService.listRoles(WORKSPACE_ID)).resolves.toEqual([
      { id: ROLE_ID, name: 'Clerk', permissions: ['RECORDS_CREATE'], memberCount: 3 },
    ])
    expect(prismaMock.workspaceRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: WORKSPACE_ID },
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      }),
    )
  })
})

describe('RoleService.createRole', () => {
  beforeEach(() => {
    prismaMock.workspaceRole.count.mockResolvedValue(3)
    prismaMock.workspaceRole.create.mockResolvedValue(roleRow(['RECORDS_CREATE']))
  })

  it('creates a role within the actor’s own permissions, in the proved workspace', async () => {
    await expect(
      RoleService.createRole(manager, { name: 'Clerk', permissions: ['RECORDS_CREATE'] }),
    ).resolves.toMatchObject({ id: ROLE_ID, memberCount: 0 })

    expect(prismaMock.workspaceRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { workspaceId: WORKSPACE_ID, name: 'Clerk', permissions: ['RECORDS_CREATE'] },
      }),
    )
  })

  it('refuses a permission the actor lacks before anything is read or written', async () => {
    await expect(
      RoleService.createRole(manager, { name: 'Boss', permissions: ['TABLES_MANAGE'] }),
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(prismaMock.workspaceRole.count).not.toHaveBeenCalled()
    expect(prismaMock.workspaceRole.create).not.toHaveBeenCalled()
  })

  it('lets the owner grant everything', async () => {
    await RoleService.createRole(owner, { name: 'All', permissions: [...WORKSPACE_PERMISSIONS] })

    expect(prismaMock.workspaceRole.create).toHaveBeenCalledTimes(1)
  })

  it('refuses a role over the cap with a 409, writing nothing', async () => {
    prismaMock.workspaceRole.count.mockResolvedValue(MAX_WORKSPACE_ROLES)

    await expect(
      RoleService.createRole(owner, { name: 'One more', permissions: [] }),
    ).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: `A workspace can have at most ${MAX_WORKSPACE_ROLES} roles`,
    })
    expect(prismaMock.workspaceRole.count).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID },
    })
    expect(prismaMock.workspaceRole.create).not.toHaveBeenCalled()
  })

  it('reports a taken name as a 409', async () => {
    prismaMock.workspaceRole.create.mockRejectedValue(knownError('P2002'))

    await expect(
      RoleService.createRole(owner, { name: 'Editor', permissions: [] }),
    ).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'A role with this name already exists',
    })
  })
})

describe('RoleService.updateRole', () => {
  it('reads the role inside the proved workspace, then writes it there', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: ['RECORDS_CREATE'] })
    prismaMock.workspaceRole.update.mockResolvedValue(roleRow(['RECORDS_UPDATE'], 2))

    await expect(
      RoleService.updateRole(manager, ROLE_ID, { name: 'Clerk', permissions: ['RECORDS_UPDATE'] }),
    ).resolves.toMatchObject({ permissions: ['RECORDS_UPDATE'], memberCount: 2 })

    expect(prismaMock.workspaceRole.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: roleWhere }),
    )
    expect(prismaMock.workspaceRole.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: roleWhere,
        data: { name: 'Clerk', permissions: ['RECORDS_UPDATE'] },
      }),
    )
  })

  it('is a 404 for a role outside the workspace', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(null)

    await expect(
      RoleService.updateRole(manager, ROLE_ID, { name: 'Clerk', permissions: [] }),
    ).rejects.toMatchObject({ statusCode: 404, statusMessage: 'Role not found' })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it('refuses to change a role that already grants more than the actor holds', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: ['TABLES_MANAGE'] })

    await expect(
      RoleService.updateRole(manager, ROLE_ID, { name: 'Clerk', permissions: [] }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it('refuses to raise a role above the actor', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: [] })

    await expect(
      RoleService.updateRole(manager, ROLE_ID, { name: 'Clerk', permissions: ['MEMBERS_MANAGE'] }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it('reports a role deleted since it was read as missing', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: [] })
    prismaMock.workspaceRole.update.mockRejectedValue(knownError('P2025'))

    await expect(
      RoleService.updateRole(manager, ROLE_ID, { name: 'Clerk', permissions: [] }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('RoleService.deleteRole', () => {
  it('deletes by the compound key, so another workspace’s role cannot match', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: [] })
    prismaMock.workspaceRole.delete.mockResolvedValue({ id: ROLE_ID })

    await RoleService.deleteRole(manager, ROLE_ID)

    expect(prismaMock.workspaceRole.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: roleWhere }),
    )
  })

  it('refuses a role above the actor before deleting', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({
      permissions: ['ROLES_MANAGE', 'TABLES_MANAGE'],
    })

    await expect(RoleService.deleteRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.delete).not.toHaveBeenCalled()
  })

  it('turns a role still held by a member into a 409, without counting first', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue({ permissions: [] })
    prismaMock.workspaceRole.delete.mockRejectedValue(knownError('P2003'))

    await expect(RoleService.deleteRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Reassign the members of this role first',
    })
    expect(prismaMock.workspaceMember.findMany).not.toHaveBeenCalled()
    expect(prismaMock.workspaceRole.count).not.toHaveBeenCalled()
  })
})
