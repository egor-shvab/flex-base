import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { MAX_WORKSPACE_ROLES, RoleService } from '#server/services/roles'
import { WORKSPACE_PERMISSIONS } from '#shared/constants/workspace'
import type { ITableAccess, TWorkspacePermission } from '#shared/types/workspace'
import {
  buildMembership,
  buildPermissionSetRow as setRow,
  buildRecordDefaults,
  buildRoleInput as input,
  MEMBERSHIP_WORKSPACE_ID as WORKSPACE_ID,
} from '~~/test/membership'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const ROLE_ID = 'rol_1'

const manager = buildMembership(['ROLES_MANAGE'], {
  recordDefaults: buildRecordDefaults({ canCreate: true, updateScope: 'ALL' }),
})
const owner = buildMembership([], { isOwner: true })

const READ_AT = new Date('2026-02-11T16:30:00.000Z')

const CREATE = { canCreate: true } as const
const UPDATE = { updateScope: 'ALL' } as const
const DELETE = { deleteScope: 'ALL' } as const

const roleRow = (
  permissions: TWorkspacePermission[],
  records: Partial<ITableAccess> = {},
  memberCount = 0,
) => ({
  id: ROLE_ID,
  name: 'Clerk',
  ...setRow(permissions, records),
  updatedAt: READ_AT,
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
    prismaMock.workspaceRole.findMany.mockResolvedValue([roleRow([], CREATE, 3)])

    await expect(RoleService.listRoles(WORKSPACE_ID)).resolves.toEqual([
      {
        id: ROLE_ID,
        name: 'Clerk',
        permissions: [],
        recordDefaults: buildRecordDefaults(CREATE),
        memberCount: 3,
        updatedAt: READ_AT.toISOString(),
      },
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
    prismaMock.workspaceRole.create.mockResolvedValue(roleRow([], CREATE))
  })

  it('creates a role within the actor’s own reach, in the proved workspace', async () => {
    await expect(
      RoleService.createRole(manager, input('Clerk', [], CREATE)),
    ).resolves.toMatchObject({ id: ROLE_ID, memberCount: 0 })

    expect(prismaMock.workspaceRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          workspaceId: WORKSPACE_ID,
          name: 'Clerk',
          permissions: [],
          ...buildRecordDefaults(CREATE),
        },
      }),
    )
  })

  it.each([
    ['a permission', input('Boss', ['TABLES_MANAGE'])],
    ['a record action', input('Boss', [], DELETE)],
  ])('refuses %s the actor lacks before anything is read or written', async (_, role) => {
    await expect(RoleService.createRole(manager, role)).rejects.toMatchObject({ statusCode: 403 })

    expect(prismaMock.workspaceRole.count).not.toHaveBeenCalled()
    expect(prismaMock.workspaceRole.create).not.toHaveBeenCalled()
  })

  it('lets the owner grant everything', async () => {
    await RoleService.createRole(
      owner,
      input('All', [...WORKSPACE_PERMISSIONS], { ...CREATE, ...UPDATE, ...DELETE }),
    )

    expect(prismaMock.workspaceRole.create).toHaveBeenCalledTimes(1)
  })

  it('refuses a role over the cap with a 409, writing nothing', async () => {
    prismaMock.workspaceRole.count.mockResolvedValue(MAX_WORKSPACE_ROLES)

    await expect(RoleService.createRole(owner, input('One more'))).rejects.toMatchObject({
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

    await expect(RoleService.createRole(owner, input('Editor'))).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'A role with this name already exists',
    })
  })
})

describe('RoleService.updateRole', () => {
  it('reads the role inside the proved workspace, then writes it there', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow([], CREATE))
    prismaMock.workspaceRole.update.mockResolvedValue(roleRow([], UPDATE, 2))

    await expect(
      RoleService.updateRole(manager, ROLE_ID, input('Clerk', [], UPDATE)),
    ).resolves.toMatchObject({ recordDefaults: buildRecordDefaults(UPDATE), memberCount: 2 })

    expect(prismaMock.workspaceRole.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: roleWhere }),
    )
    expect(prismaMock.workspaceRole.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...roleWhere, permissions: { equals: [] }, ...buildRecordDefaults(CREATE) },
        data: { name: 'Clerk', permissions: [], ...buildRecordDefaults(UPDATE) },
      }),
    )
  })

  it('is a 404 for a role outside the workspace', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(null)

    await expect(RoleService.updateRole(manager, ROLE_ID, input('Clerk'))).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Role not found',
    })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it('refuses to change a role that already grants more than the actor holds', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow([], DELETE))

    await expect(RoleService.updateRole(manager, ROLE_ID, input('Clerk'))).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it.each([
    ['a permission', input('Clerk', ['MEMBERS_MANAGE'])],
    ['a record action', input('Clerk', [], DELETE)],
  ])('refuses to raise a role above the actor by %s', async (_, next) => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow())

    await expect(RoleService.updateRole(manager, ROLE_ID, next)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.update).not.toHaveBeenCalled()
  })

  it('reports a role deleted since it was read as missing', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValueOnce(setRow()).mockResolvedValueOnce(null)
    prismaMock.workspaceRole.update.mockRejectedValue(knownError('P2025'))

    await expect(RoleService.updateRole(manager, ROLE_ID, input('Clerk'))).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('refuses with a 409 when the role’s grants changed under the check', async () => {
    prismaMock.workspaceRole.findUnique
      .mockResolvedValueOnce(setRow())
      .mockResolvedValueOnce({ id: ROLE_ID })
    prismaMock.workspaceRole.update.mockRejectedValue(knownError('P2025'))

    await expect(RoleService.updateRole(manager, ROLE_ID, input('Clerk'))).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})

describe('RoleService.deleteRole', () => {
  it('deletes by the compound key, so another workspace’s role cannot match', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow())
    prismaMock.workspaceRole.delete.mockResolvedValue({ id: ROLE_ID })

    await RoleService.deleteRole(manager, ROLE_ID)

    expect(prismaMock.workspaceRole.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...roleWhere, permissions: { equals: [] }, ...buildRecordDefaults() },
      }),
    )
  })

  it('refuses a role above the actor before deleting', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow(['ROLES_MANAGE', 'TABLES_MANAGE']))

    await expect(RoleService.deleteRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.workspaceRole.delete).not.toHaveBeenCalled()
  })

  it('turns a role still held by a member into a 409, without counting first', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow())
    prismaMock.workspaceRole.delete.mockRejectedValue(knownError('P2003'))

    await expect(RoleService.deleteRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Reassign the members of this role and revoke its invitations first',
    })
    expect(prismaMock.workspaceMember.findMany).not.toHaveBeenCalled()
    expect(prismaMock.workspaceRole.count).not.toHaveBeenCalled()
  })
})

describe('RoleService.requireAssignableRole', () => {
  it('passes a role within the actor’s reach, found by the compound key', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(setRow([], CREATE))

    await expect(RoleService.requireAssignableRole(manager, ROLE_ID)).resolves.toBeUndefined()
    expect(prismaMock.workspaceRole.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: roleWhere }),
    )
  })

  it.each([
    ['a permission', setRow(['TABLES_MANAGE'])],
    ['a record action', setRow([], DELETE)],
  ])('refuses a role granting %s the actor lacks, but not to the owner', async (_, row) => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(row)

    await expect(RoleService.requireAssignableRole(manager, ROLE_ID)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'You can only assign roles within your own permissions',
    })
    await expect(RoleService.requireAssignableRole(owner, ROLE_ID)).resolves.toBeUndefined()
  })

  it('answers a role of another workspace as missing', async () => {
    prismaMock.workspaceRole.findUnique.mockResolvedValue(null)

    await expect(RoleService.requireAssignableRole(owner, ROLE_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Role not found',
    })
  })
})
