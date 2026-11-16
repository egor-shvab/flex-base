import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '#server/db/prisma'
import { MAX_WORKSPACE_ROLES, RoleService } from '#server/services/roles'
import { WorkspaceService } from '#server/services/workspaces'
import type { IWorkspaceMembership } from '#shared/types/workspace'
import { addMember, createUser, type TSeededUser } from '~~/test/integration/seed'
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
    const roles = await RoleService.listRoles(ada.workspace.id)
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

    const roles = await RoleService.listRoles(ada.workspace.id)

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

    const [stored] = (await RoleService.listRoles(ada.workspace.id)).filter((r) => r.id === role.id)
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
