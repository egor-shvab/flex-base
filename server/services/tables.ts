import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { toHttpError } from '#server/db/prisma-errors'
import { tableListSelect } from '#server/db/tables'

const tableErrors = {
  conflict: 'A table with this name already exists',
  notFound: 'Table not found',
}

export function listTables(userId: string) {
  return prisma.table.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: tableListSelect,
  })
}

export async function createTable(userId: string, name: string) {
  try {
    return await prisma.table.create({ data: { userId, name }, select: tableListSelect })
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

export async function renameTable(userId: string, tableId: string, name: string) {
  try {
    return await prisma.table.update({
      where: { id: tableId, userId },
      data: { name },
      select: tableListSelect,
    })
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
