import { createError } from 'h3'
import { fieldSelect, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import { tableSelect, tableWhere, toSharedTable } from '#server/db/tables'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'
import type { TFieldInput } from '#shared/validation/field'

function tableNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Table not found' })
}

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

export async function requireFieldTarget(userId: string, input: TFieldInput): Promise<void> {
  if (input.type !== 'RELATION') return

  // A cuid only: an all-digit target would resolve as a table number and then be stored
  // verbatim in `options.targetTableId`, where every reader expects an id
  if (parseTableAddress(input.targetTableId) !== 0) throw tableNotFound()

  const { fields } = await requireOwnedTableFields(userId, input.targetTableId)

  if (!fields.some((field) => field.key === input.labelFieldKey)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown field to show for the link' })
  }
}

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
