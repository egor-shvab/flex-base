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
 * The address is resolved to the id before the guard runs, and that order is load-bearing:
 * `options.targetTableId` stores a cuid, so a number would match nothing and the guard would pass.
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
