import type { Prisma } from '#server/generated/prisma/client'
import type { ITable, ITableListItem } from '#shared/types/table'
import { parseAddressNumber } from '#shared/utils/address'

/**
 * Which row a table-scoped route's address selects: the public **number** a URL carries, or the
 * **cuid** older links still use.
 *
 * The two are unambiguous — a cuid is never all digits — so one function answers both, and this
 * is the only place the server knows there are two forms. Its record counterpart is
 * `recordWhere`; keeping them side by side is what makes them read as one rule rather than two
 * coincidences.
 *
 * **Both branches scope the owner inside the `where`**, so §5 is untouched: what changes is which
 * column identifies the row, never whether ownership is part of the query.
 *
 * A malformed address — `12abc`, `0`, empty, anything past a PostgreSQL `Int` — parses to `0` and
 * takes the id branch, where it matches nothing and 404s as it always has.
 */
export function tableWhere(userId: string, address: string): Prisma.TableWhereUniqueInput {
  const number = parseAddressNumber(address)

  return number === 0 ? { id: address, userId } : { userId_number: { userId, number } }
}

/**
 * The table itself, without the counts only the dashboard needs. Shared by the table service
 * and by the ownership helpers, which is why it lives here rather than in either of them.
 */
export const tableSelect = {
  id: true,
  number: true,
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
    number: row.number,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** The same row with the counts the list surfaces read. */
export function toSharedTableListItem(row: TTableListRow): ITableListItem {
  return { ...toSharedTable(row), _count: row._count }
}
