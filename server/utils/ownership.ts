import { createError } from 'h3'
import { fieldSelect, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/generated/prisma/client'
import { tableSelect, toSharedTable } from '#server/db/tables'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'
import { parseAddressNumber } from '#shared/utils/address'
import type { TFieldInput } from '#shared/validation/field'

/** Another user's table must be indistinguishable from a missing one — never 403. */
function tableNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Table not found' })
}

/**
 * How a table-scoped route names its table: by the public **number** a URL carries, or by the
 * **cuid** older links still use.
 *
 * The two are unambiguous — a cuid is never all digits — so one function answers both, and this
 * is the only place in the server that knows there are two forms. Keeping it to one place is
 * what stops the transition becoming the scattered conditional §9 forbids.
 *
 * **Both branches scope on the owner inside the `where`**, so §5's rule is untouched: what
 * changes is which column identifies the row, never whether ownership is part of the query.
 *
 * A malformed address — `12abc`, `0`, empty, anything past a PostgreSQL `Int` — parses to `0`
 * and falls to the id branch, where it simply matches nothing and 404s as it always has.
 */
function tableWhere(userId: string, address: string): Prisma.TableWhereUniqueInput {
  const number = parseAddressNumber(address)

  return number === 0 ? { id: address, userId } : { userId_number: { userId, number } }
}

/**
 * Asserts the table exists AND belongs to the user in a single scoped query. Answers in the
 * shape every layer above the database speaks, like its `Fields` sibling below — a helper that
 * handed back a Prisma row would leak `Date`s into a response typed on ISO strings.
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
 * What a table-scoped route needs to do its own work: the table's **resolved id** and its field
 * metadata, from one scoped query — reads need the fields to resolve sort/filter params, writes
 * to build their validation schema.
 *
 * **The id is returned rather than echoed back from the caller**, because the address it was
 * asked for may have been a number. Every route below this builds its own `where` from
 * `tableId`, so handing the raw address through would put `"12"` where a cuid belongs.
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
 * The table itself alongside its field metadata, from the same scoped query. The detail
 * dialog draws a record of a table the page it opened from is not about, so it has to name
 * that table as well as read its fields.
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
 * A RELATION may only point at a table the same user owns, labelled by a field that table
 * actually has — neither is knowable to the shared schema, which has no database. It is an
 * ownership question about a *second* table, which is why it sits here and reads through the
 * helper above rather than living in the field service.
 */
export async function requireFieldTarget(userId: string, input: TFieldInput): Promise<void> {
  if (input.type !== 'RELATION') return

  // A cuid, out of the field's own options — never a route address. It needs no special entry
  // point: the resolver above reads either form, and a cuid takes the branch it always did.
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
