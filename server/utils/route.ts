import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { parseAddressNumber } from '#shared/utils/address'

/**
 * A route parameter, as every handler wants to read one.
 *
 * **The `''` fallback is the whole point.** `getRouterParam` returns `string | undefined`, and an
 * `undefined` reaching a Prisma `where` clause is not a miss — it drops the condition, so a
 * scoped query silently widens to every row. An empty string matches nothing instead, which turns
 * a malformed route into the 404 the ownership helpers already answer with.
 *
 * Nitro's routing means a handler under `[tableId]/` is only reached with that param bound, so the
 * fallback is unreachable in production. It is here because being unreachable is not the same as
 * being safe to omit, and because it was once restated at every call site with the reasoning at
 * none of them. The `tableId` reads now live in `utils/handler.ts`; what is left at a route is the
 * second param — a `fieldId` or a `recordId`.
 */
export function routeParam(event: H3Event, name: string): string {
  return getRouterParam(event, name) ?? ''
}

/**
 * The same, for a parameter that addresses a row by its public number.
 *
 * **`0` is `''`'s counterpart**, and it is needed for a sharper reason: an unparseable `''`
 * merely matches nothing, but an unparseable *number* is `NaN`, and one past a PostgreSQL `Int`
 * overflows — both of which make Prisma throw, turning a malformed address into a 500 where it
 * owes a 404. `parseAddressNumber` answers `0` instead, which no row can hold, so the ownership
 * helpers keep answering the way they already do and nothing here has to raise.
 *
 * Strict on purpose: a table's *browser* URL may carry a `12-deals` slug, but the client builds
 * API paths from the number alone, so a route param that is not all digits is malformed rather
 * than decorated.
 */
export function numericRouteParam(event: H3Event, name: string): number {
  return parseAddressNumber(routeParam(event, name))
}
