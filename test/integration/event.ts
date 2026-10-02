import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, getResponseHeader, type H3Event } from 'h3'
import type { IAuthUser } from '#shared/types/auth'

type TQueryInput = Record<string, string | string[]>

interface IEventInput {
  user?: IAuthUser | null
  params?: Record<string, string>
  query?: TQueryInput
  body?: unknown
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  ip?: string
}

function toSearch(query: TQueryInput): string {
  const params = new URLSearchParams()

  for (const [name, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : [value]) params.append(name, entry)
  }

  const search = params.toString()
  return search === '' ? '' : `?${search}`
}

export function testEvent({
  user = null,
  params = {},
  query = {},
  body,
  method = 'GET',
  ip,
}: IEventInput = {}): H3Event {
  const socket = new Socket()
  if (ip !== undefined) Object.defineProperty(socket, 'remoteAddress', { value: ip })

  const request = new IncomingMessage(socket)
  request.method = method
  request.url = `/api${toSearch(query)}`

  if (body !== undefined) {
    const payload = JSON.stringify(body)
    request.headers['content-type'] = 'application/json'
    // Required: without a content-length h3 returns an empty body without reading the stream
    request.headers['content-length'] = String(Buffer.byteLength(payload))
    request.push(payload)
  }
  request.push(null)

  const event = createEvent(request, new ServerResponse(request))
  event.context.user = user
  event.context.params = params

  return event
}

export function cookieHeader(event: H3Event): string {
  return String(getResponseHeader(event, 'set-cookie') ?? '')
}
