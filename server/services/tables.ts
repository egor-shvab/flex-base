import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { toHttpError } from '#server/db/prisma-errors'
import { tableListSelect, toSharedTableListItem } from '#server/db/tables'
import type { ITableListItem } from '#shared/types/table'

const tableErrors = {
  conflict: 'A table with this name already exists',
  notFound: 'Table not found',
}

export async function listTables(userId: string): Promise<ITableListItem[]> {
  const tables = await prisma.table.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: tableListSelect,
  })

  return tables.map(toSharedTableListItem)
}

/**
 * The table's list row as it stands now — what a write to its fields or its records answers
 * with, so the counts the sidebar and the dashboard draw are **received rather than computed**.
 * The client used to move them by a delta of its own, which is arithmetic over a number only
 * the database knows.
 *
 * Unscoped by owner on purpose: every caller reaches it through a handler factory that has
 * already proven ownership of this table, the same contract `listFields(tableId)` works under.
 */
export async function getTableListRow(tableId: string): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.findUniqueOrThrow({ where: { id: tableId }, select: tableListSelect }),
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

export async function createTable(userId: string, name: string): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.create({ data: { userId, name }, select: tableListSelect }),
    )
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

export async function renameTable(
  userId: string,
  tableId: string,
  name: string,
): Promise<ITableListItem> {
  try {
    return toSharedTableListItem(
      await prisma.table.update({
        where: { id: tableId, userId },
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

export async function deleteTable(userId: string, tableId: string) {
  await assertNotRelationTarget(userId, tableId)

  try {
    await prisma.table.delete({ where: { id: tableId, userId } })
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}
