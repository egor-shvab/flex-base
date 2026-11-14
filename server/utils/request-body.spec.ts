import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, type H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { assertBodyWithin } from '#server/utils/request-body'

function eventWith(headers: Record<string, string>): H3Event {
  const request = new IncomingMessage(new Socket())
  request.method = 'POST'
  Object.assign(request.headers, headers)
  return createEvent(request, new ServerResponse(request))
}

const check = (headers: Record<string, string>) => () =>
  assertBodyWithin(eventWith(headers), 100, 'Too large')

describe('assertBodyWithin', () => {
  it('lets a body up to the cap through', () => {
    expect(check({ 'content-length': '100' })).not.toThrow()
  })

  it('refuses a declared length past the cap with a 413, before reading anything', () => {
    expect(check({ 'content-length': '101' })).toThrow(
      expect.objectContaining({ statusCode: 413, statusMessage: 'Too large' }),
    )
  })

  it('refuses chunked encoding, which declares no length to cap', () => {
    expect(check({ 'transfer-encoding': 'chunked' })).toThrow(
      expect.objectContaining({ statusCode: 411 }),
    )
  })

  it('lets a request with no body at all through', () => {
    expect(check({})).not.toThrow()
  })
})
