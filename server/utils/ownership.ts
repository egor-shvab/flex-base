import { createError } from 'h3'
import { fieldSelect, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import { tableSelect, tableWhere, toSharedTable } from '#server/db/tables'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'
import type { TFieldInput } from '#shared/validation/field'

/** Another user's table must be indistinguishable from a missing one — never 403. */
function tableNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Table not found' })
}

/**
 * Asserts the table exists AND belongs to the user in a single scoped query, answering in the
 * shape every layer above the database speaks — a Prisma row would leak `Date`s into a response
 * typed on ISO strings.
 */
export async function requireOwnedTable(userId: string, address: string): Promise<ITable> {
  const table = await prisma.table.findUnique({
    where: tableWhere(userId, address),
    select: tableSelect,
  })

  if (!table) {
    throw tableNotFound()
  }

  return toSharedTable(table)
}

/**
 * What a table-scoped route needs: the table's **resolved id** and its field metadata, from one
 * scoped query — reads need the fields for sort/filter params, writes for their schema.
 *
 * **The id is returned rather than echoed back from the caller**, because the address may have
 * been a number and every route below builds its `where` from `tableId`.
 */
export interface IOwnedTableFields {
  tableId: string
  fields: IField[]
}

export async function requireOwnedTableFields(
  userId: string,
  address: string,
): Promise<IOwnedTableFields> {
  const table = await prisma.table.findUnique({
    where: tableWhere(userId, address),
    select: { id: true, fields: { orderBy: { order: 'asc' }, select: fieldSelect } },
  })

  if (!table) {
    throw tableNotFound()
  }

  return { tableId: table.id, fields: table.fields.map(toSharedField) }
}

/**
 * The table itself alongside its field metadata, from one scoped query — the detail dialog draws
 * a record of a table the page is not about, so it has to name it as well as read its fields.
 */
export async function requireOwnedTableWithFields(userId: string, address: string) {
  const table = await prisma.table.findUnique({
    where: tableWhere(userId, address),
    select: { ...tableSelect, fields: { orderBy: { order: 'asc' }, select: fieldSelect } },
  })

  if (!table) {
    throw tableNotFound()
  }

  return { table: toSharedTable(table), fields: table.fields.map(toSharedField) }
}

/**
 * A RELATION may only point at a table the same user owns, labelled by a field that table has —
 * neither knowable to the shared schema. An ownership question about a *second* table, which is
 * why it sits here rather than in the field service.
 */
export async function requireFieldTarget(userId: string, input: TFieldInput): Promise<void> {
  if (input.type !== 'RELATION') return

  // **A cuid, and only a cuid.** This one comes out of a request body, not a route, and the
  // resolver below reads either form — so an all-digit target would resolve as a table *number*
  // and then be stored verbatim in `options.targetTableId`, where every reader expects an id.
  // Refused rather than resolved, which is the 404 an unknown id already answers with.
  if (parseTableAddress(input.targetTableId) !== 0) throw tableNotFound()

  const { fields } = await requireOwnedTableFields(userId, input.targetTableId)

  if (!fields.some((field) => field.key === input.labelFieldKey)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown field to show for the link' })
  }
}

/**
 * The same metadata, for writes: a table without fields has no record shape to
 * validate against, so writing to it is rejected up front.
 */
export async function requireRecordFields(
  userId: string,
  address: string,
): Promise<IOwnedTableFields> {
  const owned = await requireOwnedTableFields(userId, address)

  if (owned.fields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'This table has no fields yet' })
  }

  return owned
}
