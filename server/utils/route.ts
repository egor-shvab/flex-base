import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'

/**
 * A route parameter, as every handler wants to read one.
 *
 * **The `''` fallback is the whole point.** `getRouterParam` returns `string | undefined`, and an
 * `undefined` reaching a Prisma `where` clause is not a miss — it drops the condition, so a
 * scoped query silently widens to every row. An empty string matches nothing instead, which turns
 * a malformed route into the 404 the ownership helpers already answer with.
 *
 * Nitro's routing means a handler under `[tableAddress]/` is only reached with that param bound,
 * so the fallback is unreachable in production. It is here because being unreachable is not the
 * same as being safe to omit, and because it was once restated at every call site with the
 * reasoning at none of them. The `tableAddress` reads now live in `utils/handler.ts`; what is left
 * at a route is the second param — a `fieldId`, or a `recordAddress`.
 */
export function routeParam(event: H3Event, name: string): string {
  return getRouterParam(event, name) ?? ''
}
