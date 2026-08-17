import { createError } from 'h3'
import { fieldSelect, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import { tableSelect, toSharedTable } from '#server/db/tables'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'
import type { TFieldInput } from '#shared/validation/field'

/** Another user's table must be indistinguishable from a missing one — never 403. */
function tableNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Table not found' })
}

/**
 * Asserts the table exists AND belongs to the user in a single scoped query. Answers in the
 * shape every layer above the database speaks, like its `Fields` sibling below — a helper that
 * handed back a Prisma row would leak `Date`s into a response typed on ISO strings.
 */
export async function requireOwnedTable(userId: string, tableId: string): Promise<ITable> {
  const table = await prisma.table.findUnique({
    where: { id: tableId, userId },
    select: tableSelect,
  })

  if (!table) {
    throw tableNotFound()
  }

  return toSharedTable(table)
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

  return table.fields.map(toSharedField)
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

  return { table: toSharedTable(table), fields: table.fields.map(toSharedField) }
}

/**
 * A RELATION may only point at a table the same user owns, labelled by a field that table
 * actually has — neither is knowable to the shared schema, which has no database. It is an
 * ownership question about a *second* table, which is why it sits here and reads through the
 * helper above rather than living in the field service.
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
