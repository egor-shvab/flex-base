import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'

/**
 * A route parameter, as every handler wants to read one.
 *
 * **The `''` fallback is the whole point.** `getRouterParam` returns `string | undefined`, and an
 * `undefined` reaching a Prisma `where` clause drops the condition, silently widening a scoped
 * query to every row. An empty string matches nothing, turning a malformed route into the 404
 * the ownership helpers already answer with.
 *
 * Nitro's routing means the param is always bound, so the fallback is unreachable in production
 * — unreachable is not the same as safe to omit. `tableAddress` reads live in `utils/handler.ts`;
 * what is left at a route is the second param, a `fieldId` or a `recordAddress`.
 */
export function routeParam(event: H3Event, name: string): string {
  return getRouterParam(event, name) ?? ''
}
