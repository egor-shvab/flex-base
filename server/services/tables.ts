import { createError } from 'h3'
import { dropFieldIndexes, listIndexedFieldIds } from '#server/db/field-indexes'
import { prisma } from '#server/db/prisma'
import { recordBackgroundFailure } from '#server/utils/error-log-file'
import { toHttpError } from '#server/utils/http-errors'
import { tableListSelect, buildTableAddressWhere, toSharedTableListItem } from '#server/db/tables'
import type { ITableListItem } from '#shared/types/table'

const tableErrors = {
  conflict: 'A table with this name already exists',
  notFound: 'Table not found',
}

async function listTables(workspaceId: string): Promise<ITableListItem[]> {
  const tables = await prisma.table.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    select: tableListSelect,
  })

  return tables.map(toSharedTableListItem)
}

async function getTableListRow(workspaceId: string, tableId: string): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.findUniqueOrThrow({
        where: { id: tableId, workspaceId },
        select: tableListSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

async function createTable(workspaceId: string, name: string): Promise<ITableListItem> {
  try {
    const table = await prisma.$transaction(async (tx) => {
      const { tableCounter } = await tx.workspace.update({
        where: { id: workspaceId },
        data: { tableCounter: { increment: 1 } },
        select: { tableCounter: true },
      })

      return tx.table.create({
        data: { workspaceId, name, number: tableCounter },
        select: tableListSelect,
      })
    })

    return toSharedTableListItem(table)
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

async function renameTable(
  workspaceId: string,
  address: string,
  name: string,
): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.update({
        where: buildTableAddressWhere(workspaceId, address),
        data: { name },
        select: tableListSelect,
      }),
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

async function assertNotRelationTarget(workspaceId: string, tableId: string) {
  const reference = await prisma.field.findFirst({
    where: {
      type: 'RELATION',
      table: { workspaceId },
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
async function deleteTable(workspaceId: string, address: string) {
  const table = await prisma.table.findUnique({
    where: buildTableAddressWhere(workspaceId, address),
    select: { id: true },
  })

  if (!table) {
    throw createError({ statusCode: 404, statusMessage: tableErrors.notFound })
  }

  await assertNotRelationTarget(workspaceId, table.id)
  const indexedFieldIds = await listIndexedFieldIds({ tableId: table.id })

  try {
    await prisma.table.delete({ where: { id: table.id } })
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }

  void dropFieldIndexes(indexedFieldIds).catch(recordBackgroundFailure)
}

export const TableService = {
  listTables,
  getTableListRow,
  createTable,
  renameTable,
  deleteTable,
}
