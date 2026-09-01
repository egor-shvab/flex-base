import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { toHttpError } from '#server/utils/http-errors'
import { tableListSelect, tableWhere, toSharedTableListItem } from '#server/db/tables'
import type { ITableListItem } from '#shared/types/table'

const tableErrors = {
  conflict: 'A table with this name already exists',
  notFound: 'Table not found',
}

async function listTables(userId: string): Promise<ITableListItem[]> {
  const tables = await prisma.table.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: tableListSelect,
  })

  return tables.map(toSharedTableListItem)
}

/**
 * The table's list row as it stands — what a write to its fields or records answers with, so the
 * counts the sidebar and dashboard draw are **received rather than computed**.
 *
 * Scoped by owner like every other write here, even though all four callers reach it through a
 * factory that has already proven ownership: the check costs nothing on a query that runs
 * anyway, and it is the signature that enforces it, so a fifth caller cannot compile.
 */
async function getTableListRow(userId: string, tableId: string): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.findUniqueOrThrow({
        where: { id: tableId, userId },
        select: tableListSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

/**
 * The number is allocated from its owner's counter in the same transaction as the insert — the
 * shape `createRecord` uses one level down. The atomic increment takes the user's row lock, so
 * concurrent creates queue rather than race.
 *
 * A failed create leaves no gap: a duplicate name raises inside the transaction, so the
 * increment rolls back with it. Gaps come only from deletes, which is the point of a
 * high-water mark — deleting table 3 must not hand that number to a different table later.
 */
async function createTable(userId: string, name: string): Promise<ITableListItem> {
  try {
    const table = await prisma.$transaction(async (tx) => {
      const { tableCounter } = await tx.user.update({
        where: { id: userId },
        data: { tableCounter: { increment: 1 } },
        select: { tableCounter: true },
      })

      return tx.table.create({
        data: { userId, name, number: tableCounter },
        select: tableListSelect,
      })
    })

    return toSharedTableListItem(table)
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

async function renameTable(userId: string, address: string, name: string): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.update({
        where: tableWhere(userId, address),
        data: { name },
        select: tableListSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

/**
 * A relation's target lives in opaque `options` JSON, so no foreign key protects it — the
 * cascade would silently break every link. Deleting a referenced table is refused instead,
 * naming the field to remove first.
 */
async function assertNotRelationTarget(userId: string, tableId: string) {
  const reference = await prisma.field.findFirst({
    where: {
      type: 'RELATION',
      table: { userId },
      options: { path: ['targetTableId'], equals: tableId },
    },
    select: { name: true, table: { select: { name: true } } },
  })

  if (reference) {
    throw createError({
      statusCode: 409,
      statusMessage: `"${reference.name}" in "${reference.table.name}" links to this table`,
    })
  }
}

/**
 * **The address is resolved to the id before the guard runs, and that ordering is load-bearing.**
 * `assertNotRelationTarget` compares `options.targetTableId`, which stores a cuid — hand it a
 * number and it matches nothing, the guard silently passes, and the delete cascades a table that
 * relations still point at. Nothing would error; every stored link would simply go blank.
 *
 * Three queries rather than two, on a rare and irreversible operation. That is the right trade:
 * the alternative is a guard that stops guarding depending on how the URL was written.
 */
async function deleteTable(userId: string, address: string) {
  const table = await prisma.table.findUnique({
    where: tableWhere(userId, address),
    select: { id: true },
  })

  if (!table) {
    throw createError({ statusCode: 404, statusMessage: tableErrors.notFound })
  }

  await assertNotRelationTarget(userId, table.id)

  try {
    await prisma.table.delete({ where: { id: table.id } })
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

export const TableService = {
  listTables,
  getTableListRow,
  createTable,
  renameTable,
  deleteTable,
}
