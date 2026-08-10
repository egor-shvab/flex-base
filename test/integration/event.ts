import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, getResponseHeader, type H3Event } from 'h3'
import type { IAuthUser } from '#shared/types/auth'

/** A repeated param is an array, exactly as a real query string delivers it. */
type TQueryInput = Record<string, string | string[]>

interface IEventInput {
  /** What the auth middleware would have attached; `null` is an anonymous request. */
  user?: IAuthUser | null
  /** Route params, which is where `getRouterParam` reads from. */
  params?: Record<string, string>
  query?: TQueryInput
  body?: unknown
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
}

function toSearch(query: TQueryInput): string {
  const params = new URLSearchParams()

  for (const [name, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : [value]) params.append(name, entry)
  }

  const search = params.toString()
  return search === '' ? '' : `?${search}`
}

/**
 * A real `H3Event` over a real node request, so the handler under test parses its query and
 * reads its body through h3 rather than through anything this file pretends to be. Only the
 * two things Nitro would have put there — the authenticated user and the route params — are
 * supplied directly, because routing is what this layer deliberately skips.
 */
export function testEvent({
  user = null,
  params = {},
  query = {},
  body,
  method = 'GET',
}: IEventInput = {}): H3Event {
  const request = new IncomingMessage(new Socket())
  request.method = method
  request.url = `/api${toSearch(query)}`

  if (body !== undefined) {
    const payload = JSON.stringify(body)
    request.headers['content-type'] = 'application/json'
    // Required, not cosmetic: h3 returns an empty body without reading the stream at all
    // unless there is a content-length or a chunked transfer-encoding to justify it
    request.headers['content-length'] = String(Buffer.byteLength(payload))
    request.push(payload)
  }
  // Ends the stream either way — a body-less request must not hang waiting for one
  request.push(null)

  const event = createEvent(request, new ServerResponse(request))
  event.context.user = user
  event.context.params = params

  return event
}

export function cookieHeader(event: H3Event): string {
  return String(getResponseHeader(event, 'set-cookie') ?? '')
}
