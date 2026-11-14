import type { Prisma } from '#server/generated/prisma/client'
import type { ITable, ITableListItem } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'

export function buildTableAddressWhere(
  workspaceId: string,
  address: string,
): Prisma.TableWhereUniqueInput {
  const number = parseTableAddress(address)

  return number === 0
    ? { id: address, workspaceId }
    : { workspaceId_number: { workspaceId, number } }
}

export const tableSelect = {
  id: true,
  number: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TableSelect

/** Records are read from the kept count, never `_count`: that is a `COUNT(*)` per table per load. */
export const tableListSelect = {
  ...tableSelect,
  recordCount: true,
  _count: { select: { fields: true } },
} satisfies Prisma.TableSelect

export type TTableRow = Prisma.TableGetPayload<{ select: typeof tableSelect }>
export type TTableListRow = Prisma.TableGetPayload<{ select: typeof tableListSelect }>

export function toSharedTable(row: TTableRow): ITable {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSharedTableListItem(row: TTableListRow): ITableListItem {
  return {
    ...toSharedTable(row),
    _count: { fields: row._count.fields, records: row.recordCount },
  }
}
