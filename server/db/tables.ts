import type { Prisma } from '#server/generated/prisma/client'
import type { ITable, ITableListItem } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'

/**
 * Which row a table-scoped route's address selects: the public **number** a URL carries, or the
 * **cuid** older links still use.
 *
 * The two are unambiguous — a cuid is never all digits — so one function answers both, and this
 * is the only place the server knows there are two forms. `recordWhere` is its counterpart.
 *
 * **`parseTableAddress`, the same reader the page uses**, so a segment resolves to one row on
 * both sides of the wire — a slugged `12-deals` included, which `parseAddressNumber` alone would
 * fail and 404 on a page that had already resolved it.
 *
 * **Both branches scope the owner inside the `where`** (`CLAUDE.md` §5): what changes is which
 * column identifies the row, never whether ownership is part of the query.
 *
 * A malformed address parses to `0` and takes the id branch, where it matches nothing and 404s.
 */
export function tableWhere(userId: string, address: string): Prisma.TableWhereUniqueInput {
  const number = parseTableAddress(address)

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
 * `ITable`; leaving that conversion to `JSON.stringify` makes the two types disagree everywhere
 * except at the moment they are serialized.
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
