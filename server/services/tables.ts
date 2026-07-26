import type { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/utils/prisma'
import { toHttpError } from '#server/utils/prisma-errors'

const tableSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { fields: true, records: true } },
} satisfies Prisma.TableSelect

const tableErrors = {
  conflict: 'A table with this name already exists',
  notFound: 'Table not found',
}

export function listTables(userId: string) {
  return prisma.table.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: tableSelect,
  })
}

export async function createTable(userId: string, name: string) {
  try {
    return await prisma.table.create({ data: { userId, name }, select: tableSelect })
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

export async function renameTable(userId: string, tableId: string, name: string) {
  try {
    return await prisma.table.update({
      where: { id: tableId, userId },
      data: { name },
      select: tableSelect,
    })
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}

export async function deleteTable(userId: string, tableId: string) {
  try {
    await prisma.table.delete({ where: { id: tableId, userId } })
  } catch (error) {
    throw toHttpError(error, tableErrors)
  }
}
