import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '#server/db/prisma'
import { MAX_WORKSPACE_ROLES, RoleService } from '#server/services/roles'
import { WorkspaceService } from '#server/services/workspaces'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import { addMember, createUser, type TSeededUser } from '~~/test/integration/seed'
import type { TRoleAccessInput } from '#shared/validation/role-access'
import { buildRecordDefaults, buildRoleInput } from '~~/test/membership'

let ada: TSeededUser
let owner: IWorkspaceMembership

beforeEach(async () => {
  ada = await createUser('ada@example.com')
  const { memberships } = await WorkspaceService.listMemberships(ada.id)
  owner = memberships[0]!
})

const findRoleId = async (workspaceId: string, name: string) =>
  (
    await prisma.workspaceRole.findUniqueOrThrow({
      where: { workspaceId_name: { workspaceId, name } },
      select: { id: true },
    })
  ).id

describe('the roles of a workspace', () => {
  it('creates the defaults with their record access', async () => {
    const roles = await RoleService.listRoles(owner)
    const full = { readScope: 'ALL', canCreate: true, updateScope: 'ALL', deleteScope: 'ALL' }

    expect(roles.map((role) => [role.name, role.recordDefaults])).toEqual([
      ['Admin', full],
      ['Editor', full],
      ['Viewer', buildRecordDefaults()],
    ])
  })

  it('lists the defaults in the order they were made, each with its member count', async () => {
    const bob = await createUser('bob@example.com')
    await addMember(ada.workspace.id, bob.id, 'Editor')

    const roles = await RoleService.listRoles(owner)

    expect(roles.map((role) => [role.name, role.memberCount])).toEqual([
      ['Admin', 1],
      ['Editor', 1],
      ['Viewer', 0],
    ])
  })
})

describe('deleting a role', () => {
  it('is refused with a 409 by the foreign key while a member holds it', async () => {
    const bob = await createUser('bob@example.com')
    await addMember(ada.workspace.id, bob.id, 'Editor')
    const editorId = await findRoleId(ada.workspace.id, 'Editor')

    await expect(RoleService.deleteRole(owner, editorId)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Reassign the members of this role and revoke its invitations first',
    })
    await expect(
      prisma.workspaceRole.findUnique({ where: { id: editorId } }),
    ).resolves.not.toBeNull()
  })

  it('removes a role nobody holds', async () => {
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')

    await RoleService.deleteRole(owner, viewerId)

    await expect(prisma.workspaceRole.findUnique({ where: { id: viewerId } })).resolves.toBeNull()
  })

  it('cannot reach another workspace’s role by its id', async () => {
    const bob = await createUser('bob@example.com')
    const bobsViewerId = await findRoleId(bob.workspace.id, 'Viewer')

    await expect(RoleService.deleteRole(owner, bobsViewerId)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(
      prisma.workspaceRole.findUnique({ where: { id: bobsViewerId } }),
    ).resolves.not.toBeNull()
  })
})

describe('creating and changing a role', () => {
  it('stores it, and refuses a second role of the same name', async () => {
    const role = await RoleService.createRole(
      owner,
      buildRoleInput('Clerk', ['TABLES_MANAGE'], { canCreate: true, deleteScope: 'ALL' }),
    )

    expect(role).toMatchObject({
      name: 'Clerk',
      permissions: ['TABLES_MANAGE'],
      recordDefaults: buildRecordDefaults({ canCreate: true, deleteScope: 'ALL' }),
      memberCount: 0,
    })
    await expect(
      RoleService.updateRole(owner, role.id, buildRoleInput('Editor')),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuses a save made on a version someone has since replaced, keeping theirs', async () => {
    const role = await RoleService.createRole(owner, buildRoleInput('Clerk'))
    const opened = new Date(role.updatedAt)

    await RoleService.updateRole(
      owner,
      role.id,
      buildRoleInput('Clerk', [], { canCreate: true }),
      opened,
    )
    await expect(
      RoleService.updateRole(owner, role.id, buildRoleInput('Typist'), opened),
    ).rejects.toMatchObject({ statusCode: 412 })

    const [stored] = (await RoleService.listRoles(owner)).filter((r) => r.id === role.id)
    expect(stored).toMatchObject({
      name: 'Clerk',
      recordDefaults: buildRecordDefaults({ canCreate: true }),
    })
  })

  it('stops at the cap', async () => {
    await prisma.workspaceRole.createMany({
      data: Array.from({ length: MAX_WORKSPACE_ROLES - 3 }, (_, index) => ({
        workspaceId: ada.workspace.id,
        name: `Role ${index}`,
        permissions: [],
      })),
    })

    await expect(
      RoleService.createRole(owner, buildRoleInput('One too many')),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('a role’s access to tables and fields', () => {
  async function seedDeals() {
    const table = await prisma.table.create({
      data: { workspaceId: ada.workspace.id, name: 'Deals', number: 1 },
      select: { id: true },
    })
    const field = await prisma.field.create({
      data: { tableId: table.id, key: 'salary', name: 'Salary', type: 'NUMBER', order: 0 },
      select: { id: true },
    })
    return { tableId: table.id, fieldId: field.id }
  }

  const access = (overrides: Partial<TRoleAccessInput> = {}): TRoleAccessInput => ({
    recordDefaults: buildRecordDefaults(),
    tables: [],
    fields: [],
    ...overrides,
  })

  const rowsOf = async (roleId: string) => ({
    tables: await prisma.roleTableAccess.count({ where: { roleId } }),
    fields: await prisma.roleFieldAccess.count({ where: { roleId } }),
  })

  it('replaces every row at once, and moves the role’s version', async () => {
    const { tableId, fieldId } = await seedDeals()
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')
    const before = await RoleService.getRoleAccess(owner, viewerId)

    await RoleService.updateRoleAccess(
      owner,
      viewerId,
      access({
        tables: [{ tableId, ...buildRecordDefaults({ readScope: 'OWN' }) }],
        fields: [{ fieldId, access: 'HIDDEN' }],
      }),
    )
    const saved = await RoleService.updateRoleAccess(
      owner,
      viewerId,
      access({ fields: [{ fieldId, access: 'READ' }] }),
    )

    expect(saved.overrides).toEqual({ tables: [], fields: [{ fieldId, access: 'READ' }] })
    expect(await rowsOf(viewerId)).toEqual({ tables: 0, fields: 1 })
    expect(saved.role.updatedAt).not.toBe(before.role.updatedAt)
    expect(saved.tables.map((table) => table.name)).toEqual(['Deals'])
  })

  it('refuses a stale version, keeping the rows it had', async () => {
    const { fieldId } = await seedDeals()
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')
    const opened = new Date((await RoleService.getRoleAccess(owner, viewerId)).role.updatedAt)

    await RoleService.updateRoleAccess(
      owner,
      viewerId,
      access({ fields: [{ fieldId, access: 'HIDDEN' }] }),
      opened,
    )
    await expect(
      RoleService.updateRoleAccess(owner, viewerId, access(), opened),
    ).rejects.toMatchObject({ statusCode: 412 })
    expect(await rowsOf(viewerId)).toEqual({ tables: 0, fields: 1 })
  })

  it('drops the rows with their table, their field or their role', async () => {
    const { tableId, fieldId } = await seedDeals()
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')
    const next = access({
      tables: [{ tableId, ...buildRecordDefaults() }],
      fields: [{ fieldId, access: 'HIDDEN' }],
    })
    await RoleService.updateRoleAccess(owner, viewerId, next)

    await prisma.field.delete({ where: { id: fieldId } })
    expect(await rowsOf(viewerId)).toEqual({ tables: 1, fields: 0 })

    await prisma.table.delete({ where: { id: tableId } })
    expect(await rowsOf(viewerId)).toEqual({ tables: 0, fields: 0 })

    const clerk = await RoleService.createRole(owner, buildRoleInput('Clerk'))
    const second = await seedDeals()
    await RoleService.updateRoleAccess(
      owner,
      clerk.id,
      access({ fields: [{ fieldId: second.fieldId, access: 'READ' }] }),
    )
    await RoleService.deleteRole(owner, clerk.id)
    expect(await rowsOf(clerk.id)).toEqual({ tables: 0, fields: 0 })
  })

  it('keeps a manager from handing out a role that sees a field hidden from them', async () => {
    const { fieldId } = await seedDeals()
    const editorId = await findRoleId(ada.workspace.id, 'Editor')
    const managerRole = await RoleService.createRole(
      owner,
      buildRoleInput('Manager', ['MEMBERS_MANAGE', 'ROLES_MANAGE'], {
        canCreate: true,
        updateScope: 'ALL',
        deleteScope: 'ALL',
      }),
    )
    await RoleService.updateRoleAccess(
      owner,
      managerRole.id,
      access({
        recordDefaults: buildRecordDefaults({
          canCreate: true,
          updateScope: 'ALL',
          deleteScope: 'ALL',
        }),
        fields: [{ fieldId, access: 'HIDDEN' }],
      }),
    )
    const bob = await createUser('bob@example.com')
    await addMember(ada.workspace.id, bob.id, 'Manager')
    const { memberships } = await WorkspaceService.listMemberships(bob.id)
    const manager = memberships.find((membership) => membership.workspace.id === ada.workspace.id)!

    const roles = await RoleService.listRoles(manager)
    expect(roles.find((role) => role.id === editorId)?.isWithinCaller).toBe(false)
    await expect(RoleService.requireAssignableRole(manager, editorId)).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})
