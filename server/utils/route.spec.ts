import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { routeParam } from '#server/utils/route'

function eventWith(params: Record<string, string> | undefined): H3Event {
  return { context: { params } } as unknown as H3Event
}

describe('routeParam', () => {
  it('returns the bound parameter', () => {
    expect(routeParam(eventWith({ tableId: 'tbl_1', fieldId: 'fld_2' }), 'tableId')).toBe('tbl_1')
    expect(routeParam(eventWith({ tableId: 'tbl_1', fieldId: 'fld_2' }), 'fieldId')).toBe('fld_2')
  })

  it('is an empty string when the parameter is missing, never undefined', () => {
    expect(routeParam(eventWith({}), 'tableId')).toBe('')
    expect(routeParam(eventWith(undefined), 'tableId')).toBe('')
  })
})
