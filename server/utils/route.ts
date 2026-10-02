import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'

/**
 * The `''` fallback is the point: `undefined` in a Prisma `where` drops the condition and widens
 * a scoped query to every row, where `''` matches nothing.
 */
export function routeParam(event: H3Event, name: string): string {
  return getRouterParam(event, name) ?? ''
}
