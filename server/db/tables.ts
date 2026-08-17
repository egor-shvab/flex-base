import type { Prisma } from '#server/generated/prisma/client'
import type { ITable, ITableListItem } from '#shared/types/table'

/**
 * The table itself, without the counts only the dashboard needs. Shared by the table service
 * and by the ownership helpers, which is why it lives here rather than in either of them.
 */
export const tableSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TableSelect

/** The same plus the counts the dashboard and the sidebar draw. */
export const tableListSelect = {
  ...tableSelect,
  _count: { select: { fields: true, records: true } },
} satisfies Prisma.TableSelect

export type TTableRow = Prisma.TableGetPayload<{ select: typeof tableSelect }>
export type TTableListRow = Prisma.TableGetPayload<{ select: typeof tableListSelect }>

/**
 * A row as the wire carries it. The timestamps are `Date`s in the database and ISO strings in
 * `ITable`, and writing that conversion down is the point: leaving it to `JSON.stringify` made
 * the two types disagree everywhere except at the one moment they were serialized.
 */
export function toSharedTable(row: TTableRow): ITable {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** The same row with the counts the list surfaces read. */
export function toSharedTableListItem(row: TTableListRow): ITableListItem {
  return { ...toSharedTable(row), _count: row._count }
}
