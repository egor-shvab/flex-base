import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { numericRouteParam, routeParam } from '#server/utils/route'

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

/**
 * The numeric counterpart. `shared/utils/address.spec.ts` owns the parsing case table; what is
 * pinned here is only the wrapper's own contract — that a missing or malformed parameter lands
 * on the sentinel rather than on `NaN`, which is the value that would reach Prisma and throw.
 */
describe('numericRouteParam', () => {
  it('returns the bound parameter as a number', () => {
    expect(numericRouteParam(eventWith({ tableId: '12', recordId: '48' }), 'tableId')).toBe(12)
    expect(numericRouteParam(eventWith({ tableId: '12', recordId: '48' }), 'recordId')).toBe(48)
  })

  it('is 0 when the parameter is missing, never NaN', () => {
    expect(numericRouteParam(eventWith({}), 'tableId')).toBe(0)
    expect(numericRouteParam(eventWith(undefined), 'tableId')).toBe(0)
  })

  /** A slug belongs to the browser URL; an API route param that is not all digits is malformed. */
  it('does not accept the slug form a table’s page URL may carry', () => {
    expect(numericRouteParam(eventWith({ tableId: '12-deals' }), 'tableId')).toBe(0)
  })
})
