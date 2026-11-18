import { beforeEach, describe, expect, it } from 'vitest'
import { FULL_TABLE_ACCESS } from '#shared/constants/workspace'
import { TableService } from '#server/services/tables'
import { prisma } from '#server/db/prisma'
import {
  addMember,
  createField,
  createRecord,
  createTable,
  createUser,
} from '~~/test/integration/seed'

let workspaceId: string
let ownerRoleId: string

beforeEach(async () => {
  const user = await createUser()
  workspaceId = user.workspace.id
  ownerRoleId = user.workspace.ownerRoleId
})

describe('table names are unique per workspace, in the database', () => {
  it('refuses a second table of the same name', async () => {
    await TableService.createTable(workspaceId, 'Deals', ownerRoleId)

    await expect(TableService.createTable(workspaceId, 'Deals', ownerRoleId)).rejects.toMatchObject(
      {
        statusCode: 409,
        statusMessage: 'A table with this name already exists',
      },
    )
  })

  it('lets a different user take that name', async () => {
    const other = await createUser()
    await TableService.createTable(workspaceId, 'Deals', ownerRoleId)

    await expect(
      TableService.createTable(other.workspace.id, 'Deals', other.workspace.ownerRoleId),
    ).resolves.toMatchObject({
      name: 'Deals',
    })
  })

  it('refuses a rename onto a name already taken', async () => {
    await TableService.createTable(workspaceId, 'Deals', ownerRoleId)
    const second = await TableService.createTable(workspaceId, 'Leads', ownerRoleId)

    await expect(
      TableService.renameTable(workspaceId, second.id, 'Deals', FULL_TABLE_ACCESS),
    ).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('404s renaming a table belonging to someone else, and leaves its name alone', async () => {
    const other = await createUser()
    const theirs = await createTable(other.workspace.id, 'Theirs')

    await expect(
      TableService.renameTable(workspaceId, theirs.id, 'Mine', FULL_TABLE_ACCESS),
    ).rejects.toMatchObject({
      statusCode: 404,
    })

    const unchanged = await prisma.table.findUniqueOrThrow({ where: { id: theirs.id } })
    expect(unchanged.name).toBe('Theirs')
  })
})

describe('a new table', () => {
  it('opens to its creator’s role in full, the owner’s included, and to no other role', async () => {
    const table = await TableService.createTable(workspaceId, 'Deals', ownerRoleId)

    const rows = await prisma.roleTableAccess.findMany({
      where: { tableId: table.id },
      select: {
        roleId: true,
        readScope: true,
        canCreate: true,
        updateScope: true,
        deleteScope: true,
      },
    })
    expect(rows).toEqual([{ roleId: ownerRoleId, ...FULL_TABLE_ACCESS }])
  })
})

describe('table numbers', () => {
  const numberOf = async (tableId: string) =>
    (await prisma.table.findUniqueOrThrow({ where: { id: tableId }, select: { number: true } }))
      .number

  it('starts at one', async () => {
    const table = await TableService.createTable(workspaceId, 'Deals', ownerRoleId)

    await expect(numberOf(table.id)).resolves.toBe(1)
  })

  it('increments per table', async () => {
    await TableService.createTable(workspaceId, 'Deals', ownerRoleId)
    await TableService.createTable(workspaceId, 'People', ownerRoleId)
    const third = await TableService.createTable(workspaceId, 'Companies', ownerRoleId)

    await expect(numberOf(third.id)).resolves.toBe(3)
  })

  it('gives every concurrent create a distinct number', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        TableService.createTable(workspaceId, `Co ${index}`, ownerRoleId),
      ),
    )

    const rows = await prisma.table.findMany({ where: { workspaceId }, select: { number: true } })
    const numbers = rows.map((row) => row.number).sort((a, b) => a - b)

    expect(new Set(numbers).size).toBe(20)
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
  })

  it('never reuses the number of a deleted table', async () => {
    const first = await TableService.createTable(workspaceId, 'Deals', ownerRoleId)
    await TableService.createTable(workspaceId, 'People', ownerRoleId)

    await TableService.deleteTable(workspaceId, first.id)
    const next = await TableService.createTable(workspaceId, 'Companies', ownerRoleId)

    await expect(numberOf(next.id)).resolves.toBe(3)
  })

  it('counts per user rather than globally', async () => {
    const other = await createUser()

    await TableService.createTable(workspaceId, 'Deals', ownerRoleId)
    const elsewhere = await TableService.createTable(
      other.workspace.id,
      'Deals',
      other.workspace.ownerRoleId,
    )

    await expect(numberOf(elsewhere.id)).resolves.toBe(1)
  })

  it('is unique per user in the database, not only by convention', async () => {
    await TableService.createTable(workspaceId, 'Deals', ownerRoleId)

    await expect(
      prisma.table.create({ data: { workspaceId, name: 'People', number: 1 } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('burns no number when the create is refused', async () => {
    await TableService.createTable(workspaceId, 'Deals', ownerRoleId)
    await expect(TableService.createTable(workspaceId, 'Deals', ownerRoleId)).rejects.toMatchObject(
      {
        statusCode: 409,
      },
    )

    const next = await TableService.createTable(workspaceId, 'People', ownerRoleId)

    await expect(numberOf(next.id)).resolves.toBe(2)
  })
})

describe('deleting a table', () => {
  it('takes its fields and records with it', async () => {
    const table = await createTable(workspaceId)
    const field = await createField(table.id, { key: 'company', type: 'TEXT' })
    const record = await createRecord(table.id, { company: 'Acme' })

    await TableService.deleteTable(workspaceId, table.id)

    await expect(prisma.field.findUnique({ where: { id: field.id } })).resolves.toBeNull()
    await expect(prisma.record.findUnique({ where: { id: record.id } })).resolves.toBeNull()
  })

  it('refuses while a relation still points at it, naming the field', async () => {
    const target = await createTable(workspaceId, 'People')
    const source = await createTable(workspaceId, 'Deals')
    await createField(source.id, {
      key: 'owner',
      name: 'Owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(TableService.deleteTable(workspaceId, target.id)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: '"Owner" in "Deals" links to this table',
    })

    await expect(prisma.table.findUnique({ where: { id: target.id } })).resolves.not.toBeNull()
  })

  it('refuses by number too, rather than deleting past a guard that matched nothing', async () => {
    const target = await createTable(workspaceId, 'People')
    const source = await createTable(workspaceId, 'Deals')
    await createField(source.id, {
      key: 'owner',
      name: 'Owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(
      TableService.deleteTable(workspaceId, String(target.number)),
    ).rejects.toMatchObject({
      statusCode: 409,
    })

    await expect(prisma.table.findUnique({ where: { id: target.id } })).resolves.not.toBeNull()
  })

  it('deletes by number when nothing points at it', async () => {
    const table = await createTable(workspaceId, 'Disposable')

    await TableService.deleteTable(workspaceId, String(table.number))

    await expect(prisma.table.findUnique({ where: { id: table.id } })).resolves.toBeNull()
  })

  it('404s on a number no table of this user has', async () => {
    await expect(TableService.deleteTable(workspaceId, '9999')).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Table not found',
    })
  })

  it('allows it once the relation field is gone', async () => {
    const target = await createTable(workspaceId, 'People')
    const source = await createTable(workspaceId, 'Deals')
    const relation = await createField(source.id, {
      key: 'owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await prisma.field.delete({ where: { id: relation.id } })

    await expect(TableService.deleteTable(workspaceId, target.id)).resolves.toBeUndefined()
  })

  it('ignores a relation belonging to someone else', async () => {
    const target = await createTable(workspaceId, 'People')
    const other = await createUser()
    const theirs = await createTable(other.workspace.id, 'Theirs')
    await createField(theirs.id, {
      key: 'owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(TableService.deleteTable(workspaceId, target.id)).resolves.toBeUndefined()
  })

  it('lets the source table itself be deleted while it still holds the relation', async () => {
    const target = await createTable(workspaceId, 'People')
    const source = await createTable(workspaceId, 'Deals')
    await createField(source.id, {
      key: 'owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(TableService.deleteTable(workspaceId, source.id)).resolves.toBeUndefined()
  })

  it('404s for a table belonging to someone else, and leaves it standing', async () => {
    const other = await createUser()
    const theirs = await createTable(other.workspace.id)

    await expect(TableService.deleteTable(workspaceId, theirs.id)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(prisma.table.findUnique({ where: { id: theirs.id } })).resolves.not.toBeNull()
  })
})

describe('deleting a workspace', () => {
  it('cascades to its tables, fields, records, roles and members in one statement', async () => {
    const member = await createUser()
    await addMember(workspaceId, member.id, 'Editor')
    const table = await createTable(workspaceId)
    await createField(table.id, { key: 'company', type: 'TEXT' })
    await createRecord(table.id, { company: 'Acme' })

    // Roles and members go in the same statement: a RESTRICT on roleId would fail here
    await prisma.workspace.delete({ where: { id: workspaceId } })

    await expect(prisma.table.findUnique({ where: { id: table.id } })).resolves.toBeNull()
    await expect(prisma.record.count({ where: { tableId: table.id } })).resolves.toBe(0)
    await expect(prisma.workspaceRole.count({ where: { workspaceId } })).resolves.toBe(0)
    await expect(prisma.workspaceMember.count({ where: { workspaceId } })).resolves.toBe(0)
  })

  it('refuses to delete a role a member still holds', async () => {
    const member = await createUser()
    await addMember(workspaceId, member.id, 'Editor')

    await expect(
      prisma.workspaceRole.delete({
        where: { workspaceId_name: { workspaceId, name: 'Editor' } },
      }),
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('refuses a member a role of another workspace', async () => {
    const other = await createUser()
    const foreignRole = await prisma.workspaceRole.findUniqueOrThrow({
      where: { workspaceId_name: { workspaceId: other.workspace.id, name: 'Admin' } },
      select: { id: true },
    })
    const member = await createUser()

    await expect(
      prisma.workspaceMember.create({
        data: { workspaceId, userId: member.id, roleId: foreignRole.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' })
  })
})
