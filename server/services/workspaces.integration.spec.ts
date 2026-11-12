import { beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceService } from '#server/services/workspaces'
import { prisma } from '#server/db/prisma'
import {
  addMember,
  createField,
  createRecord,
  createTable,
  createUser,
  type TSeededUser,
} from '~~/test/integration/seed'

let ada: TSeededUser

beforeEach(async () => {
  ada = await createUser('ada@example.com')
})

describe('creating a workspace', () => {
  it('makes the caller its owner, under the default roles', async () => {
    const membership = await WorkspaceService.createWorkspace(ada.id, 'Acme')

    expect(membership).toMatchObject({ isOwner: true, role: { name: 'Admin' } })
    expect(membership.workspace.publicId).toMatch(/^[a-z0-9]{10}$/)

    const roles = await prisma.workspaceRole.findMany({
      where: { workspaceId: membership.workspace.id },
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    expect(roles.map((role) => role.name)).toEqual(['Admin', 'Editor', 'Viewer'])

    const { memberships } = await WorkspaceService.listMemberships(ada.id)
    expect(memberships.map((entry) => entry.workspace.name)).toEqual(['Personal workspace', 'Acme'])
  })

  it('numbers its tables from one, apart from the caller’s other workspaces', async () => {
    await createTable(ada.workspace.id)
    const membership = await WorkspaceService.createWorkspace(ada.id, 'Acme')

    await expect(createTable(membership.workspace.id)).resolves.toMatchObject({ number: 1 })
  })
})

describe('deleting a workspace', () => {
  it('takes its tables, fields, records, roles and memberships with it', async () => {
    const bob = await createUser('bob@example.com')
    await addMember(ada.workspace.id, bob.id, 'Editor')
    const table = await createTable(ada.workspace.id, 'Deals')
    const field = await createField(table.id, { key: 'company', type: 'TEXT' })
    await createRecord(table.id, { company: 'Acme' })

    await WorkspaceService.deleteWorkspace(ada.workspace.id)

    const where = { workspaceId: ada.workspace.id }
    await expect(prisma.workspace.count({ where: { id: ada.workspace.id } })).resolves.toBe(0)
    await expect(prisma.table.count({ where })).resolves.toBe(0)
    await expect(prisma.field.count({ where: { id: field.id } })).resolves.toBe(0)
    await expect(prisma.record.count({ where: { tableId: table.id } })).resolves.toBe(0)
    await expect(prisma.workspaceRole.count({ where })).resolves.toBe(0)
    await expect(prisma.workspaceMember.count({ where })).resolves.toBe(0)
  })

  it('leaves its people and their other workspaces alone', async () => {
    const bob = await createUser('bob@example.com')
    await addMember(ada.workspace.id, bob.id, 'Viewer')
    const kept = await createTable(bob.workspace.id, 'Kept')

    await WorkspaceService.deleteWorkspace(ada.workspace.id)

    await expect(prisma.user.count({ where: { id: { in: [ada.id, bob.id] } } })).resolves.toBe(2)
    await expect(prisma.table.count({ where: { id: kept.id } })).resolves.toBe(1)
    await expect(WorkspaceService.listMemberships(bob.id)).resolves.toMatchObject({
      memberships: [{ workspace: { id: bob.workspace.id } }],
    })
  })

  it('forgets it as anyone’s last workspace', async () => {
    const bob = await createUser('bob@example.com')
    await addMember(ada.workspace.id, bob.id, 'Viewer')
    await WorkspaceService.setLastWorkspace(ada.id, ada.workspace.id)
    await WorkspaceService.setLastWorkspace(bob.id, ada.workspace.id)

    await WorkspaceService.deleteWorkspace(ada.workspace.id)

    const rows = await prisma.user.findMany({
      where: { id: { in: [ada.id, bob.id] } },
      select: { lastWorkspaceId: true },
    })
    expect(rows).toEqual([{ lastWorkspaceId: null }, { lastWorkspaceId: null }])
  })

  it('reports one already gone as a missing workspace', async () => {
    await WorkspaceService.deleteWorkspace(ada.workspace.id)

    await expect(WorkspaceService.deleteWorkspace(ada.workspace.id)).rejects.toMatchObject({
      statusCode: 404,
      data: { missing: 'workspace' },
    })
  })
})
