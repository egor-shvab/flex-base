import { createError } from 'h3'
import { fieldSelect, toFieldMetadata } from '#server/services/fields'
import { tableSelect } from '#server/services/tables'
import { prisma } from '#server/utils/prisma'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

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
 * Ownership check plus the table's field metadata in the same round trip — reads need
 * it to resolve sort/filter params, writes to build their validation schema.
 */
export async function requireOwnedTableFields(userId: string, tableId: string): Promise<IField[]> {
  const table = await prisma.table.findUnique({
    where: { id: tableId, userId },
    select: { id: true, fields: { orderBy: { order: 'asc' }, select: fieldSelect } },
  })

  if (!table) {
    throw tableNotFound()
  }

  return table.fields.map(toFieldMetadata)
}

/**
 * The table itself alongside its field metadata, from the same scoped query. The detail
 * dialog draws a record of a table the page it opened from is not about, so it has to name
 * that table as well as read its fields.
 */
export async function requireOwnedTableWithFields(userId: string, tableId: string) {
  const table = await prisma.table.findUnique({
    where: { id: tableId, userId },
    select: { ...tableSelect, fields: { orderBy: { order: 'asc' }, select: fieldSelect } },
  })

  if (!table) {
    throw tableNotFound()
  }

  return { table, fields: table.fields.map(toFieldMetadata) }
}

/**
 * A RELATION may only point at a table the same user owns, labelled by a field that table
 * actually has — neither is knowable to the shared schema, which has no database. Lives
 * here rather than in `services/fields`, which this module already imports.
 */
export async function requireFieldTarget(userId: string, input: TFieldInput): Promise<void> {
  if (input.type !== 'RELATION') return

  const targetFields = await requireOwnedTableFields(userId, input.targetTableId)

  if (!targetFields.some((field) => field.key === input.labelFieldKey)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown field to show for the link' })
  }
}

/**
 * The same metadata, for writes: a table without fields has no record shape to
 * validate against, so writing to it is rejected up front.
 */
export async function requireRecordFields(userId: string, tableId: string): Promise<IField[]> {
  const fields = await requireOwnedTableFields(userId, tableId)

  if (fields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'This table has no fields yet' })
  }

  return fields
}
