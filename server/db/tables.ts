import type { Prisma } from '#server/generated/prisma/client'
import type { ITable, ITableListItem } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'

export function tableWhere(userId: string, address: string): Prisma.TableWhereUniqueInput {
  const number = parseTableAddress(address)

  return number === 0 ? { id: address, userId } : { userId_number: { userId, number } }
}

export const tableSelect = {
  id: true,
  number: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TableSelect

export const tableListSelect = {
  ...tableSelect,
  _count: { select: { fields: true, records: true } },
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
  return { ...toSharedTable(row), _count: row._count }
}
