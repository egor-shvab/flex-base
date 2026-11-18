import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '#server/db/prisma'
import { MAX_WORKSPACE_ROLES, RoleService } from '#server/services/roles'
import { WorkspaceService } from '#server/services/workspaces'
import { FULL_TABLE_ACCESS, NO_TABLE_ACCESS } from '#shared/constants/workspace'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import { addMember, createUser, type TSeededUser } from '~~/test/integration/seed'
import type { TRoleInput } from '#shared/validation/workspace'
import { buildTableAccess, buildRoleInput } from '~~/test/membership'

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
  it('creates the defaults reaching no table, the workspace having none yet', async () => {
    const roles = await RoleService.listRoles(owner)

    expect(roles.map((role) => [role.name, role.readableTableCount])).toEqual([
      ['Admin', 0],
      ['Editor', 0],
      ['Viewer', 0],
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
    const { role } = await RoleService.createRole(owner, buildRoleInput('Clerk', ['TABLES_MANAGE']))

    expect(role).toMatchObject({ name: 'Clerk', permissions: ['TABLES_MANAGE'], memberCount: 0 })
    await expect(
      RoleService.updateRole(owner, role.id, buildRoleInput('Editor')),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuses a save made on a version someone has since replaced, keeping theirs', async () => {
    const { role } = await RoleService.createRole(owner, buildRoleInput('Clerk'))
    const opened = new Date(role.updatedAt)

    await RoleService.updateRole(
      owner,
      role.id,
      buildRoleInput('Clerk', ['WORKSPACE_UPDATE']),
      opened,
    )
    await expect(
      RoleService.updateRole(owner, role.id, buildRoleInput('Typist'), opened),
    ).rejects.toMatchObject({ statusCode: 412 })

    const [stored] = (await RoleService.listRoles(owner)).filter((r) => r.id === role.id)
    expect(stored).toMatchObject({ name: 'Clerk', permissions: ['WORKSPACE_UPDATE'] })
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

  /** The seeded Viewer reading Deals, as the editor sends it back with its rows. */
  const access = (tableId: string, overrides: Partial<TRoleInput> = {}): TRoleInput => ({
    ...buildRoleInput('Viewer', [], [{ tableId, ...buildTableAccess() }]),
    ...overrides,
  })

  const rowsOf = async (roleId: string) => ({
    tables: await prisma.roleTableAccess.count({ where: { roleId } }),
    fields: await prisma.roleFieldAccess.count({ where: { roleId } }),
  })

  it('replaces every row at once, and moves the role’s version', async () => {
    const { tableId, fieldId } = await seedDeals()
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')
    const before = await RoleService.getRole(owner, viewerId)

    await RoleService.updateRole(
      owner,
      viewerId,
      access(tableId, {
        tables: [{ tableId, ...buildTableAccess({ readScope: 'OWN' }) }],
        fields: [{ fieldId, access: 'HIDDEN' }],
      }),
    )
    const saved = await RoleService.updateRole(
      owner,
      viewerId,
      access(tableId, { fields: [{ fieldId, access: 'READ' }] }),
    )

    expect(saved.overrides).toEqual({
      tables: [{ tableId, ...buildTableAccess() }],
      fields: [{ fieldId, access: 'READ' }],
    })
    expect(saved.role.readableTableCount).toBe(1)
    expect(await rowsOf(viewerId)).toEqual({ tables: 1, fields: 1 })
    expect(saved.role.updatedAt).not.toBe(before.role.updatedAt)
    expect(saved.tables.map((table) => table.name)).toEqual(['Deals'])
  })

  it('refuses a stale version, keeping the rows it had', async () => {
    const { tableId, fieldId } = await seedDeals()
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')
    const opened = new Date((await RoleService.getRole(owner, viewerId)).role.updatedAt)

    await RoleService.updateRole(
      owner,
      viewerId,
      access(tableId, { fields: [{ fieldId, access: 'HIDDEN' }] }),
      opened,
    )
    await expect(
      RoleService.updateRole(owner, viewerId, access(tableId), opened),
    ).rejects.toMatchObject({ statusCode: 412 })
    expect(await rowsOf(viewerId)).toEqual({ tables: 1, fields: 1 })
  })

  it('drops the rows with their table, their field or their role', async () => {
    const { tableId, fieldId } = await seedDeals()
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')
    const next = access(tableId, { fields: [{ fieldId, access: 'HIDDEN' }] })
    await RoleService.updateRole(owner, viewerId, next)

    await prisma.field.delete({ where: { id: fieldId } })
    expect(await rowsOf(viewerId)).toEqual({ tables: 1, fields: 0 })

    await prisma.table.delete({ where: { id: tableId } })
    expect(await rowsOf(viewerId)).toEqual({ tables: 0, fields: 0 })

    const second = await seedDeals()
    const { role: clerk } = await RoleService.createRole(owner, {
      ...buildRoleInput('Clerk', [], [{ tableId: second.tableId, ...buildTableAccess() }]),
      fields: [{ fieldId: second.fieldId, access: 'READ' }],
    })
    expect(await rowsOf(clerk.id)).toEqual({ tables: 1, fields: 1 })
    await RoleService.deleteRole(owner, clerk.id)
    expect(await rowsOf(clerk.id)).toEqual({ tables: 0, fields: 0 })
  })

  it('sets one table for several roles from the table’s side, closing it with no row', async () => {
    const { tableId, fieldId } = await seedDeals()
    const viewerId = await findRoleId(ada.workspace.id, 'Viewer')
    const editorId = await findRoleId(ada.workspace.id, 'Editor')
    await RoleService.updateRole(
      owner,
      viewerId,
      access(tableId, { fields: [{ fieldId, access: 'READ' }] }),
    )
    const versionOf = async (id: string) => (await RoleService.getRole(owner, id)).role.updatedAt

    const roles = await RoleService.setTableAccess(owner, tableId, {
      roles: [
        { roleId: viewerId, updatedAt: await versionOf(viewerId), ...NO_TABLE_ACCESS },
        { roleId: editorId, updatedAt: await versionOf(editorId), ...FULL_TABLE_ACCESS },
      ],
    })

    expect(await rowsOf(viewerId)).toEqual({ tables: 0, fields: 0 })
    expect(await rowsOf(editorId)).toEqual({ tables: 1, fields: 0 })
    expect(roles.find((entry) => entry.role.id === editorId)).toMatchObject({
      access: FULL_TABLE_ACCESS,
      role: { readableTableCount: 1 },
    })
  })

  it('keeps a manager from handing out a role that sees a field hidden from them', async () => {
    const { tableId, fieldId } = await seedDeals()
    const editorId = await findRoleId(ada.workspace.id, 'Editor')
    await prisma.roleTableAccess.create({
      data: { workspaceId: ada.workspace.id, roleId: editorId, tableId, ...FULL_TABLE_ACCESS },
    })
    await RoleService.createRole(owner, {
      ...buildRoleInput(
        'Manager',
        ['MEMBERS_MANAGE', 'ROLES_MANAGE'],
        [{ tableId, ...FULL_TABLE_ACCESS }],
      ),
      fields: [{ fieldId, access: 'HIDDEN' }],
    })
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
