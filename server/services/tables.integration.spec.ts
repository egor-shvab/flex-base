import { beforeEach, describe, expect, it } from 'vitest'
import { TableService } from '#server/services/tables'
import { prisma } from '#server/db/prisma'
import { createField, createRecord, createTable, createUser } from '~~/test/integration/seed'

let userId: string

beforeEach(async () => {
  const user = await createUser()
  userId = user.id
})

describe('table names are unique per user, in the database', () => {
  it('refuses a second table of the same name', async () => {
    await TableService.createTable(userId, 'Deals')

    await expect(TableService.createTable(userId, 'Deals')).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'A table with this name already exists',
    })
  })

  it('lets a different user take that name', async () => {
    const other = await createUser()
    await TableService.createTable(userId, 'Deals')

    await expect(TableService.createTable(other.id, 'Deals')).resolves.toMatchObject({
      name: 'Deals',
    })
  })

  it('refuses a rename onto a name already taken', async () => {
    await TableService.createTable(userId, 'Deals')
    const second = await TableService.createTable(userId, 'Leads')

    await expect(TableService.renameTable(userId, second.id, 'Deals')).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('404s renaming a table belonging to someone else, and leaves its name alone', async () => {
    const other = await createUser()
    const theirs = await createTable(other.id, 'Theirs')

    await expect(TableService.renameTable(userId, theirs.id, 'Mine')).rejects.toMatchObject({
      statusCode: 404,
    })

    const unchanged = await prisma.table.findUniqueOrThrow({ where: { id: theirs.id } })
    expect(unchanged.name).toBe('Theirs')
  })
})

describe('table numbers', () => {
  const numberOf = async (tableId: string) =>
    (await prisma.table.findUniqueOrThrow({ where: { id: tableId }, select: { number: true } }))
      .number

  it('starts at one', async () => {
    const table = await TableService.createTable(userId, 'Deals')

    await expect(numberOf(table.id)).resolves.toBe(1)
  })

  it('increments per table', async () => {
    await TableService.createTable(userId, 'Deals')
    await TableService.createTable(userId, 'People')
    const third = await TableService.createTable(userId, 'Companies')

    await expect(numberOf(third.id)).resolves.toBe(3)
  })

  it('gives every concurrent create a distinct number', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) => TableService.createTable(userId, `Co ${index}`)),
    )

    const rows = await prisma.table.findMany({ where: { userId }, select: { number: true } })
    const numbers = rows.map((row) => row.number).sort((a, b) => a - b)

    expect(new Set(numbers).size).toBe(20)
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
  })

  it('never reuses the number of a deleted table', async () => {
    const first = await TableService.createTable(userId, 'Deals')
    await TableService.createTable(userId, 'People')

    await TableService.deleteTable(userId, first.id)
    const next = await TableService.createTable(userId, 'Companies')

    await expect(numberOf(next.id)).resolves.toBe(3)
  })

  it('counts per user rather than globally', async () => {
    const other = await createUser()

    await TableService.createTable(userId, 'Deals')
    const elsewhere = await TableService.createTable(other.id, 'Deals')

    await expect(numberOf(elsewhere.id)).resolves.toBe(1)
  })

  it('is unique per user in the database, not only by convention', async () => {
    await TableService.createTable(userId, 'Deals')

    await expect(
      prisma.table.create({ data: { userId, name: 'People', number: 1 } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('burns no number when the create is refused', async () => {
    await TableService.createTable(userId, 'Deals')
    await expect(TableService.createTable(userId, 'Deals')).rejects.toMatchObject({
      statusCode: 409,
    })

    const next = await TableService.createTable(userId, 'People')

    await expect(numberOf(next.id)).resolves.toBe(2)
  })
})

describe('deleting a table', () => {
  it('takes its fields and records with it', async () => {
    const table = await createTable(userId)
    const field = await createField(table.id, { key: 'company', type: 'TEXT' })
    const record = await createRecord(table.id, { company: 'Acme' })

    await TableService.deleteTable(userId, table.id)

    await expect(prisma.field.findUnique({ where: { id: field.id } })).resolves.toBeNull()
    await expect(prisma.record.findUnique({ where: { id: record.id } })).resolves.toBeNull()
  })

  it('refuses while a relation still points at it, naming the field', async () => {
    const target = await createTable(userId, 'People')
    const source = await createTable(userId, 'Deals')
    await createField(source.id, {
      key: 'owner',
      name: 'Owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(TableService.deleteTable(userId, target.id)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: '"Owner" in "Deals" links to this table',
    })

    await expect(prisma.table.findUnique({ where: { id: target.id } })).resolves.not.toBeNull()
  })

  it('refuses by number too, rather than deleting past a guard that matched nothing', async () => {
    const target = await createTable(userId, 'People')
    const source = await createTable(userId, 'Deals')
    await createField(source.id, {
      key: 'owner',
      name: 'Owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(TableService.deleteTable(userId, String(target.number))).rejects.toMatchObject({
      statusCode: 409,
    })

    await expect(prisma.table.findUnique({ where: { id: target.id } })).resolves.not.toBeNull()
  })

  it('deletes by number when nothing points at it', async () => {
    const table = await createTable(userId, 'Disposable')

    await TableService.deleteTable(userId, String(table.number))

    await expect(prisma.table.findUnique({ where: { id: table.id } })).resolves.toBeNull()
  })

  it('404s on a number no table of this user has', async () => {
    await expect(TableService.deleteTable(userId, '9999')).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Table not found',
    })
  })

  it('allows it once the relation field is gone', async () => {
    const target = await createTable(userId, 'People')
    const source = await createTable(userId, 'Deals')
    const relation = await createField(source.id, {
      key: 'owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await prisma.field.delete({ where: { id: relation.id } })

    await expect(TableService.deleteTable(userId, target.id)).resolves.toBeUndefined()
  })

  it('ignores a relation belonging to someone else', async () => {
    const target = await createTable(userId, 'People')
    const other = await createUser()
    const theirs = await createTable(other.id, 'Theirs')
    await createField(theirs.id, {
      key: 'owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(TableService.deleteTable(userId, target.id)).resolves.toBeUndefined()
  })

  it('lets the source table itself be deleted while it still holds the relation', async () => {
    const target = await createTable(userId, 'People')
    const source = await createTable(userId, 'Deals')
    await createField(source.id, {
      key: 'owner',
      type: 'RELATION',
      options: { targetTableId: target.id, labelFieldKey: 'full_name' },
    })

    await expect(TableService.deleteTable(userId, source.id)).resolves.toBeUndefined()
  })

  it('404s for a table belonging to someone else, and leaves it standing', async () => {
    const other = await createUser()
    const theirs = await createTable(other.id)

    await expect(TableService.deleteTable(userId, theirs.id)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(prisma.table.findUnique({ where: { id: theirs.id } })).resolves.not.toBeNull()
  })
})

describe('deleting a user', () => {
  it('cascades to everything they own', async () => {
    const table = await createTable(userId)
    await createField(table.id, { key: 'company', type: 'TEXT' })
    await createRecord(table.id, { company: 'Acme' })

    await prisma.user.delete({ where: { id: userId } })

    await expect(prisma.table.findUnique({ where: { id: table.id } })).resolves.toBeNull()
    await expect(prisma.record.count({ where: { tableId: table.id } })).resolves.toBe(0)
  })
})
