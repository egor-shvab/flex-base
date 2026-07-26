import { createError } from 'h3'
import { fieldSelect, toFieldMetadata } from '#server/services/fields'
import { prisma } from '#server/utils/prisma'
import type { IField } from '#shared/types/field'

const tableSelect = { id: true, name: true, createdAt: true, updatedAt: true }

/** Another user's table must be indistinguishable from a missing one — never 403. */
function tableNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Table not found' })
}

/**
 * Asserts the table exists AND belongs to the user in a single scoped query.
 */
export async function requireOwnedTable(userId: string, tableId: string) {
  const table = await prisma.table.findUnique({
    where: { id: tableId, userId },
    select: tableSelect,
  })

  if (!table) {
    throw tableNotFound()
  }

  return table
}

/**
 * Ownership check plus the table's field metadata in the same round trip — record
 * writes need it to build their validation schema. A table without fields has no
 * record shape to validate against, so writing to it is rejected up front.
 */
export async function requireRecordFields(userId: string, tableId: string): Promise<IField[]> {
  const table = await prisma.table.findUnique({
    where: { id: tableId, userId },
    select: { id: true, fields: { orderBy: { order: 'asc' }, select: fieldSelect } },
  })

  if (!table) {
    throw tableNotFound()
  }

  if (table.fields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'This table has no fields yet' })
  }

  return table.fields.map(toFieldMetadata)
}
