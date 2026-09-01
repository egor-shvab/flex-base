import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { routeParam } from '#server/utils/route'

/**
 * `getRouterParam` reads `event.context.params`, so a literal standing in for the event is enough
 * to pin a one-line wrapper. That the params are bound at all is Nitro's routing, which the
 * integration suite exercises by invoking all thirteen handlers for real.
 */
function eventWith(params: Record<string, string> | undefined): H3Event {
  return { context: { params } } as unknown as H3Event
}

describe('routeParam', () => {
  it('returns the bound parameter', () => {
    expect(routeParam(eventWith({ tableId: 'tbl_1', fieldId: 'fld_2' }), 'tableId')).toBe('tbl_1')
    expect(routeParam(eventWith({ tableId: 'tbl_1', fieldId: 'fld_2' }), 'fieldId')).toBe('fld_2')
  })

  /**
   * The whole reason the helper exists. `undefined` reaching a Prisma `where` clause **drops the
   * condition** rather than matching nothing, so a scoped query would widen to every row; `''`
   * matches nothing and becomes the 404 the ownership helpers already answer with.
   */
  it('is an empty string when the parameter is missing, never undefined', () => {
    expect(routeParam(eventWith({}), 'tableId')).toBe('')
    expect(routeParam(eventWith(undefined), 'tableId')).toBe('')
  })
})
