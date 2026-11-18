import { createError } from 'h3'
import { dropFieldIndexes, listIndexedFieldIds } from '#server/db/field-indexes'
import { prisma } from '#server/db/prisma'
import { RelationService } from '#server/services/relations'
import { recordBackgroundFailure } from '#server/utils/error-log-file'
import { toHttpError } from '#server/utils/http-errors'
import {
  buildReadableTablesWhere,
  buildTableAddressWhere,
  buildRoleTableAccessSelect,
  tableListSelect,
  toSharedTableListItem,
  toTableAccess,
} from '#server/db/tables'
import { FULL_TABLE_ACCESS } from '#shared/constants/workspace'
import type { ITableListItem } from '#shared/types/table'
import type { ITableAccess, IWorkspaceMembership } from '#shared/types/workspace'
import { resolveTableAccess } from '#shared/utils/table-access'

const tableErrors = {
  conflict: 'A table with this name already exists',
  notFound: 'Table not found',
}

/** Only those the caller's role may open: a hidden table is not listed, as if it did not exist. */
async function listTables(membership: IWorkspaceMembership): Promise<ITableListItem[]> {
  const tables = await prisma.table.findMany({
    where: { workspaceId: membership.workspace.id, ...buildReadableTablesWhere(membership) },
    orderBy: { createdAt: 'asc' },
    select: { ...tableListSelect, ...buildRoleTableAccessSelect(membership.role.id) },
  })

  return tables.map((row) =>
    toSharedTableListItem(row, resolveTableAccess(membership, toTableAccess(row.roleAccess))),
  )
}

/** `access` is the caller's to the table, which decides whether its count is theirs to see. */
async function getTableListRow(
  workspaceId: string,
  tableId: string,
  access: ITableAccess,
): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.findUniqueOrThrow({
        where: { id: tableId, workspaceId },
        select: tableListSelect,
      }),
      access,
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

/**
 * A new table is closed to every role but the creator's, which gets everything there — the owner's
 * too: it binds them after a transfer, and the members sharing it would otherwise see a table they
 * cannot fill, with no one but the owner able to open it to them.
 */
async function createTable(
  workspaceId: string,
  name: string,
  creatorRoleId: string,
): Promise<ITableListItem> {
  try {
    const table = await prisma.$transaction(async (tx) => {
      const { tableCounter } = await tx.workspace.update({
        where: { id: workspaceId },
        data: { tableCounter: { increment: 1 } },
        select: { tableCounter: true },
      })

      const created = await tx.table.create({
        data: { workspaceId, name, number: tableCounter },
        select: tableListSelect,
      })
      await tx.roleTableAccess.create({
        data: { workspaceId, roleId: creatorRoleId, tableId: created.id, ...FULL_TABLE_ACCESS },
      })
      return created
    })

    return toSharedTableListItem(table, FULL_TABLE_ACCESS)
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

async function renameTable(
  workspaceId: string,
  address: string,
  name: string,
  access: ITableAccess,
): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.update({
        where: buildTableAddressWhere(workspaceId, address),
        data: { name },
        select: tableListSelect,
      }),
      access,
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
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

  await RelationService.assertNotRelationTarget(workspaceId, table.id)
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
