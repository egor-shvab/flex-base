import { Prisma } from '../generated/prisma/client'
import { prisma } from '../utils/prisma'

const tableSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { fields: true, records: true } },
} satisfies Prisma.TableSelect

/** Maps Prisma constraint errors to HTTP errors; rethrows anything else. */
function toHttpError(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return createError({
        statusCode: 409,
        statusMessage: 'A table with this name already exists',
      })
    }
    if (error.code === 'P2025') {
      return createError({ statusCode: 404, statusMessage: 'Table not found' })
    }
  }
  return error instanceof Error ? error : new Error(String(error))
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
    throw toHttpError(error)
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
    throw toHttpError(error)
  }
}

export async function deleteTable(userId: string, tableId: string) {
  try {
    await prisma.table.delete({ where: { id: tableId, userId } })
  } catch (error) {
    throw toHttpError(error)
  }
}
