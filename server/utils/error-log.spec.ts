import { createError } from 'h3'
import { describe, expect, it } from 'vitest'
import {
  buildClientErrorLogEntry,
  buildErrorLogEntry,
  formatErrorLogLine,
  isLoggableServerError,
  readErrorLogRequest,
} from '#server/utils/error-log'
import type { IErrorLogRequest } from '#server/utils/error-log'
import type { IAuthUser } from '#shared/types/auth'

const NOW = new Date('2026-08-16T09:12:04.113Z')

const USER: IAuthUser = { id: 'usr_1', email: 'owner@example.com' }

/** An `H3Event` as this module reads it — the three members `readErrorLogRequest` declares. */
function eventSource(path: string, user: IAuthUser | null = USER, method = 'GET') {
  return { method, path, context: { user } }
}

function request(overrides: Partial<IErrorLogRequest> = {}): IErrorLogRequest {
  return { method: 'GET', path: '/api/tables', queryKeys: [], userId: USER.id, ...overrides }
}

describe('isLoggableServerError', () => {
  it('logs a 5xx', () => {
    expect(isLoggableServerError(createError({ statusCode: 500 }))).toBe(true)
    expect(isLoggableServerError(createError({ statusCode: 503 }))).toBe(true)
  })

  it('logs an error carrying no HTTP status at all — the unclassified fault', () => {
    expect(isLoggableServerError(new Error('Connection reset'))).toBe(true)
    expect(isLoggableServerError('boom')).toBe(true)
  })

  // Every one of these is a deliberate outcome this app produces on purpose: `requireUser`,
  // the 404 standing in for another user's row, a duplicate name, a zod rejection
  it('skips the 4xx family, which is the app working as designed', () => {
    expect(isLoggableServerError(createError({ statusCode: 400 }))).toBe(false)
    expect(isLoggableServerError(createError({ statusCode: 401 }))).toBe(false)
    expect(isLoggableServerError(createError({ statusCode: 404 }))).toBe(false)
    expect(isLoggableServerError(createError({ statusCode: 409 }))).toBe(false)
  })
})

describe('readErrorLogRequest', () => {
  it('keeps the method and the pathname', () => {
    const result = readErrorLogRequest(eventSource('/api/tables/tbl_1/records', USER, 'POST'))

    expect(result.method).toBe('POST')
    expect(result.path).toBe('/api/tables/tbl_1/records')
  })

  it('splits the query off the path', () => {
    expect(readErrorLogRequest(eventSource('/api/tables?page=2')).path).toBe('/api/tables')
  })

  it('reduces the query to sorted, deduplicated names', () => {
    const result = readErrorLogRequest(eventSource('/api/tables?sort=name&page=2&sort=name'))

    expect(result.queryKeys).toEqual(['page', 'sort'])
  })

  it('identifies the user by id, never by email', () => {
    expect(readErrorLogRequest(eventSource('/api/tables')).userId).toBe('usr_1')
  })

  it('reports an anonymous request as a null user rather than omitting the request', () => {
    const result = readErrorLogRequest(eventSource('/api/tables', null))

    expect(result.userId).toBeNull()
    expect(result.path).toBe('/api/tables')
  })
})

describe('buildErrorLogEntry', () => {
  it('takes its timestamp from the caller', () => {
    expect(buildErrorLogEntry(new Error('boom'), null, NOW).timestamp).toBe(
      '2026-08-16T09:12:04.113Z',
    )
  })

  it('carries the name, message and stack of the error', () => {
    const entry = buildErrorLogEntry(new TypeError('bad shape'), null, NOW)

    expect(entry.name).toBe('TypeError')
    expect(entry.message).toBe('bad shape')
    expect(entry.stack).toContain('TypeError: bad shape')
  })

  it('records the status of an HTTP error and null for anything else', () => {
    expect(buildErrorLogEntry(createError({ statusCode: 503 }), null, NOW).statusCode).toBe(503)
    expect(buildErrorLogEntry(new Error('boom'), null, NOW).statusCode).toBeNull()
  })

  // h3 wraps whatever the service threw in an `H3Error` named the bare `Error`, which in the
  // log would lose the one word saying where to start reading
  it('names the error h3 wrapped, not the wrapper', () => {
    const entry = buildErrorLogEntry(createError(new TypeError('bad shape')), null, NOW)

    expect(entry.name).toBe('TypeError')
    expect(entry.message).toBe('bad shape')
    expect(entry.statusCode).toBe(500)
  })

  it('keeps the wrapper when it was raised deliberately and wraps nothing', () => {
    const entry = buildErrorLogEntry(
      createError({ statusCode: 500, statusMessage: 'Boom' }),
      null,
      NOW,
    )

    expect(entry.message).toBe('Boom')
    expect(entry.statusCode).toBe(500)
  })

  it('wraps a non-Error throw so the entry still has a name and a message', () => {
    const entry = buildErrorLogEntry('boom', null, NOW)

    expect(entry.name).toBe('Error')
    expect(entry.message).toBe('boom')
  })

  it('flattens the request half beside the error', () => {
    const entry = buildErrorLogEntry(
      new Error('boom'),
      request({ method: 'POST', path: '/api/tables/tbl_1/records', queryKeys: ['page'] }),
      NOW,
    )

    expect(entry.method).toBe('POST')
    expect(entry.path).toBe('/api/tables/tbl_1/records')
    expect(entry.queryKeys).toEqual(['page'])
    expect(entry.userId).toBe('usr_1')
  })

  it('nulls the request half for an error raised outside a request', () => {
    const entry = buildErrorLogEntry(new Error('boom'), null, NOW)

    expect(entry.method).toBeNull()
    expect(entry.path).toBeNull()
    expect(entry.queryKeys).toBeNull()
    expect(entry.userId).toBeNull()
  })
})

// Asserted on the serialized line rather than the entry object: what reaches the file is the
// only thing that can leak, and a field added later is what these cases exist to catch
describe('the redaction contract', () => {
  const line = () =>
    formatErrorLogLine(
      buildErrorLogEntry(
        createError({
          statusCode: 500,
          statusMessage: 'Internal Server Error',
          data: { issues: [{ path: ['password'], received: 'hunter2' }] },
        }),
        readErrorLogRequest(eventSource('/api/tables?search=acme%20holdings&f.stage=Won', USER)),
        NOW,
      ),
    )

  it('never carries the auth cookie or any other header', () => {
    expect(line()).not.toContain('auth_token')
    expect(line()).not.toContain('cookie')
  })

  it('never carries `error.data`, which on a zod rejection echoes the submitted value', () => {
    expect(line()).not.toContain('issues')
    expect(line()).not.toContain('hunter2')
  })

  it('carries query names but never query values', () => {
    expect(line()).toContain('search')
    expect(line()).toContain('f.stage')
    expect(line()).not.toContain('acme')
    expect(line()).not.toContain('Won')
  })

  it("never carries the user's email", () => {
    expect(line()).not.toContain('owner@example.com')
    expect(line()).toContain('usr_1')
  })
})

/**
 * The browser half, through the same formatter and file — so the contract above holds from this
 * side too, broken in different ways because here the *caller* is untrusted.
 */
describe('buildClientErrorLogEntry', () => {
  const report = {
    name: 'TypeError',
    message: 'x is not a function',
    stack: 'TypeError: x is not a function\n    at Foo',
    path: '/tables/tbl_1',
  }

  it('tags the entry as the client, so one log can hold both', () => {
    expect(buildClientErrorLogEntry(report, USER.id, NOW).source).toBe('client')
    expect(buildErrorLogEntry(new Error('boom'), null, NOW).source).toBe('server')
  })

  it('carries the name, message and stack the browser reported', () => {
    const entry = buildClientErrorLogEntry(report, USER.id, NOW)

    expect(entry.name).toBe('TypeError')
    expect(entry.message).toBe('x is not a function')
    expect(entry.stack).toContain('at Foo')
    expect(entry.path).toBe('/tables/tbl_1')
  })

  it('takes its timestamp from the caller, like its server counterpart', () => {
    expect(buildClientErrorLogEntry(report, null, NOW).timestamp).toBe('2026-08-16T09:12:04.113Z')
  })

  /** There is no request of ours being described — the browser's own is not what failed. */
  it('nulls the status, the method and the query names', () => {
    const entry = buildClientErrorLogEntry(report, USER.id, NOW)

    expect(entry.statusCode).toBeNull()
    expect(entry.method).toBeNull()
    expect(entry.queryKeys).toBeNull()
  })

  it('reports an anonymous browser as a null user', () => {
    expect(buildClientErrorLogEntry(report, null, NOW).userId).toBeNull()
  })

  it('keeps a missing stack as null rather than the string "undefined"', () => {
    expect(buildClientErrorLogEntry({ ...report, stack: undefined }, null, NOW).stack).toBeNull()
  })
})

/**
 * The same contract from the untrusted side: a client report is a body someone can write by
 * hand, so what matters is what the builder **refuses to take from it**.
 */
describe('the redaction contract, for a client report', () => {
  const line = (path: string, userId: string | null = USER.id) =>
    formatErrorLogLine(
      buildClientErrorLogEntry(
        { name: 'Error', message: 'boom', stack: 'Error: boom', path },
        userId,
        NOW,
      ),
    )

  /**
   * `path` is a string the caller controls, so a query string pasted into it would put the
   * user's data in the log by the back door. Cut at the first `?`, the same structural cut
   * `readErrorLogRequest` makes server-side.
   */
  it('cuts a query string off the reported path, values and all', () => {
    const written = line('/tables/tbl_1?search=acme%20holdings&stage=Won')

    expect(written).toContain('/tables/tbl_1')
    expect(written).not.toContain('search')
    expect(written).not.toContain('acme')
    expect(written).not.toContain('Won')
  })

  /**
   * The user id is a parameter, never a field of the report — the handler reads it from the
   * cookie. A body claiming to be someone else has no path to arrive by.
   */
  it('takes the user id from the caller, not from anything the report could carry', () => {
    expect(line('/tables/tbl_1', 'usr_from_cookie')).toContain('usr_from_cookie')
    expect(line('/tables/tbl_1', null)).toContain('"userId":null')
  })

  it("never carries the user's email, which the browser never sends and this never adds", () => {
    expect(line('/tables/tbl_1')).not.toContain('owner@example.com')
  })

  /**
   * The entry shape is closed. A field added to the report schema later would reach the file
   * silently without this, which is exactly the failure the server-side block was written for.
   */
  it('writes the declared fields and nothing else', () => {
    const entry = buildClientErrorLogEntry(
      { name: 'Error', message: 'boom', stack: 'Error: boom', path: '/x' },
      USER.id,
      NOW,
    )

    expect(Object.keys(entry).sort()).toEqual(
      [
        'message',
        'method',
        'name',
        'path',
        'queryKeys',
        'source',
        'stack',
        'statusCode',
        'timestamp',
        'userId',
      ].sort(),
    )
  })
})

describe('formatErrorLogLine — the NDJSON invariant', () => {
  // A stack is multi-line by nature, and an entry that could span lines would need a multi-line
  // rule in every reader downstream
  it('emits exactly one newline, at the end, however many the stack has', () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n    at one\n    at two'

    const line = formatErrorLogLine(buildErrorLogEntry(error, null, NOW))

    expect(line.endsWith('\n')).toBe(true)
    expect(line.split('\n')).toHaveLength(2)
  })

  it('round-trips as JSON', () => {
    const entry = buildErrorLogEntry(new Error('boom'), request(), NOW)

    expect(JSON.parse(formatErrorLogLine(entry))).toEqual(entry)
  })
})
