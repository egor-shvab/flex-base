import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { TableService } from '#server/services/tables'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const USER_ID = 'usr_1'
const TABLE_ID = 'tbl_deals'

/**
 * A row as `tableListSelect` returns one. Complete rather than `{ id }`: the service maps its
 * result onto `ITableListItem` now, so a stub standing in for that select has to carry what the
 * select actually asks for.
 */
const tableRow = {
  id: TABLE_ID,
  number: 1,
  name: 'Deals',
  createdAt: new Date('2026-01-05T09:14:00.000Z'),
  updatedAt: new Date('2026-02-11T16:30:00.000Z'),
  _count: { fields: 0, records: 0 },
}

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7.9.0' })

const missing = () =>
  new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' })

beforeEach(resetPrismaMock)

describe('TableService.listTables', () => {
  it('reads only the owner’s tables, oldest first', async () => {
    prismaMock.table.findMany.mockResolvedValue([])

    await TableService.listTables(USER_ID)

    expect(prismaMock.table.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID }, orderBy: { createdAt: 'asc' } }),
    )
  })

  it('carries the counts the dashboard reads', async () => {
    prismaMock.table.findMany.mockResolvedValue([])

    await TableService.listTables(USER_ID)

    expect(prismaMock.table.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: { select: { fields: true, records: true } },
        }),
      }),
    )
  })
})

describe('TableService.getTableListRow', () => {
  it('scopes the read by owner, so an id alone cannot reach another account’s counts', async () => {
    prismaMock.table.findUniqueOrThrow.mockResolvedValue(tableRow)

    await TableService.getTableListRow(USER_ID, TABLE_ID)

    expect(prismaMock.table.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TABLE_ID, userId: USER_ID } }),
    )
  })

  it('carries the counts the sidebar and the dashboard redraw from', async () => {
    prismaMock.table.findUniqueOrThrow.mockResolvedValue(tableRow)

    await expect(TableService.getTableListRow(USER_ID, TABLE_ID)).resolves.toMatchObject({
      _count: { fields: 0, records: 0 },
    })
  })

  /** A table that is missing and one that is another user’s are the same answer — never 403. */
  it('answers 404 when the row does not match the owner', async () => {
    prismaMock.table.findUniqueOrThrow.mockRejectedValue(missing())

    await expect(TableService.getTableListRow(USER_ID, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Table not found',
    })
  })
})

describe('TableService.createTable', () => {
  /** The counter the transaction reads before it inserts. */
  const allocates = (next: number) =>
    prismaMock.user.update.mockResolvedValue({ tableCounter: next })

  it('stamps the owner and the allocated number onto the row', async () => {
    allocates(7)
    prismaMock.table.create.mockResolvedValue(tableRow)

    await TableService.createTable(USER_ID, 'Deals')

    expect(prismaMock.table.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: USER_ID, name: 'Deals', number: 7 } }),
    )
  })

  /**
   * Asserted on the *argument*, not on the number that comes back: a read-then-write rewrite
   * would return the same number while taking no row lock, which is the whole property here.
   */
  it('allocates by incrementing the owner’s counter, inside the insert’s own transaction', async () => {
    allocates(1)
    prismaMock.table.create.mockResolvedValue(tableRow)

    await TableService.createTable(USER_ID, 'Deals')

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { tableCounter: { increment: 1 } },
      select: { tableCounter: true },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('maps a duplicate name onto a 409', async () => {
    allocates(1)
    prismaMock.table.create.mockRejectedValue(conflict())

    await expect(TableService.createTable(USER_ID, 'Deals')).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'A table with this name already exists',
    })
  })
})

describe('TableService.renameTable', () => {
  it('scopes the update by owner, so an id alone cannot reach another account’s table', async () => {
    prismaMock.table.update.mockResolvedValue(tableRow)

    await TableService.renameTable(USER_ID, TABLE_ID, 'Renamed')

    expect(prismaMock.table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TABLE_ID, userId: USER_ID },
        data: { name: 'Renamed' },
      }),
    )
  })

  it('maps a name already taken onto a 409', async () => {
    prismaMock.table.update.mockRejectedValue(conflict())

    await expect(TableService.renameTable(USER_ID, TABLE_ID, 'Deals')).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('maps a table that is gone onto a 404', async () => {
    prismaMock.table.update.mockRejectedValue(missing())

    await expect(TableService.renameTable(USER_ID, TABLE_ID, 'Deals')).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Table not found',
    })
  })
})

/**
 * A relation's target lives in opaque JSON, so no foreign key protects it and the cascade
 * would take the referenced rows with it silently. The refusal is the only thing standing
 * between a delete and every link into that table breaking.
 */
describe('TableService.deleteTable', () => {
  it('looks for a relation pointing here before deleting anything', async () => {
    prismaMock.field.findFirst.mockResolvedValue(null)
    prismaMock.table.delete.mockResolvedValue({ id: TABLE_ID })

    await TableService.deleteTable(USER_ID, TABLE_ID)

    expect(prismaMock.field.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'RELATION',
          table: { userId: USER_ID },
          options: { path: ['targetTableId'], equals: TABLE_ID },
        }),
      }),
    )
  })

  it('deletes when nothing links to the table, scoped by owner', async () => {
    prismaMock.field.findFirst.mockResolvedValue(null)
    prismaMock.table.delete.mockResolvedValue({ id: TABLE_ID })

    await TableService.deleteTable(USER_ID, TABLE_ID)

    expect(prismaMock.table.delete).toHaveBeenCalledWith({
      where: { id: TABLE_ID, userId: USER_ID },
    })
  })

  it('refuses with a 409 naming the field to remove first', async () => {
    prismaMock.field.findFirst.mockResolvedValue({ name: 'Owner', table: { name: 'Deals' } })

    await expect(TableService.deleteTable(USER_ID, TABLE_ID)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: '"Owner" in "Deals" links to this table',
    })

    expect(prismaMock.table.delete).not.toHaveBeenCalled()
  })

  it('maps a table that is already gone onto a 404', async () => {
    prismaMock.field.findFirst.mockResolvedValue(null)
    prismaMock.table.delete.mockRejectedValue(missing())

    await expect(TableService.deleteTable(USER_ID, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
