import type { ITable } from '#shared/types/table'

/**
 * How a URL addresses a row.
 *
 * A public number, never the cuid: `id` is what a relation references and the database joins
 * on, `number` is what a person reads and a link carries. The two parsers below are the only
 * place a URL segment becomes a number, so "valid" cannot drift between page and server.
 *
 * Framework-free and zod-free by necessity: `shared/utils/` sits above `validation/` in the
 * layer order, and this has to be callable from `server/utils/route.ts` as well as from a page.
 */

/**
 * A PostgreSQL `Int`, which is what `Table.number` and `Record.number` are. Past this a value
 * cannot be any row's — and would make Prisma throw rather than simply miss, which is the
 * difference between a 500 and the 404 that is owed.
 */
const MAX_ADDRESS_NUMBER = 2_147_483_647

/** Digits and nothing else. `parseInt` is deliberately unused: it reads `12abc` as `12`. */
const ADDRESS_NUMBER = /^\d+$/

/**
 * The number a URL segment addresses, or **`0` — a value no row can hold**.
 *
 * The sentinel is the whole point, and it mirrors `routeParam`'s `''` exactly. A `NaN` or an
 * out-of-range integer reaching a Prisma `where` is not a miss: it throws, and a malformed
 * address answers 500 where it owes 404. Zero simply matches nothing, so the ownership helpers
 * produce that 404 themselves and this needs no error of its own.
 */
export function parseAddressNumber(raw: string): number {
  if (!ADDRESS_NUMBER.test(raw)) return 0

  const value = Number(raw)
  return value >= 1 && value <= MAX_ADDRESS_NUMBER ? value : 0
}

/**
 * A table's address: `12` and `12-deals` both name table 12.
 *
 * **Only the leading number resolves** — the slug after it is decoration, so renaming a table
 * cannot break a link that was copied before the rename. The separator is required, which is
 * what keeps `12abc` from resolving to anything.
 */
export function parseTableAddress(raw: string): number {
  const [number = ''] = raw.split('-', 1)
  return parseAddressNumber(number)
}

/**
 * The inverse — the one seam every table link is built from, so what a URL looks like is decided
 * here rather than at each call site. It takes the row rather than the number so that widening
 * what an address carries stays a change to this function alone.
 */
export function toTableAddress(table: Pick<ITable, 'number'>): string {
  return String(table.number)
}
