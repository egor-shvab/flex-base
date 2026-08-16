import { isError } from 'h3'
import type { IAuthUser } from '#shared/types/auth'

/**
 * The request half of a log entry. Names only — never a header, a body, or a query
 * **value**. See `readErrorLogRequest` for why that is a design, not a filter.
 */
export interface IErrorLogRequest {
  method: string
  path: string
  /** Query parameter names, deduplicated and sorted. Their values are never read. */
  queryKeys: string[]
  userId: string | null
}

/**
 * One line of `logs/server-errors.log`. Flat rather than nested so a `grep` or a `jq`
 * one-liner stays trivial; the request half is null for an error raised outside a request.
 */
export interface IErrorLogEntry {
  timestamp: string
  /** null when the error carries no HTTP status — an unclassified fault. */
  statusCode: number | null
  name: string
  message: string
  stack: string | null
  method: string | null
  path: string | null
  queryKeys: string[] | null
  userId: string | null
}

/**
 * Everything `readErrorLogRequest` needs, declared structurally so an `H3Event` satisfies
 * it without this module importing one — and so a spec can pass an object literal.
 */
interface IErrorLogEventSource {
  method: string
  path: string
  context: { user: IAuthUser | null }
}

/**
 * A 4xx is this app's deliberate flow, not a fault: `requireUser`'s 401, the 404 that
 * stands in for another user's row, a 409 on a duplicate name, a zod 400. Logging those
 * would bury the faults under them — and a zod 400 carries `error.data.issues`, which
 * echoes the submitted value.
 */
export function isLoggableServerError(error: unknown): boolean {
  if (!isError(error)) return true
  return error.statusCode >= 500
}

/**
 * The request context worth keeping, read off the event.
 *
 * The redaction is structural: this never reaches for headers (which carry the
 * `auth_token` cookie), for the body (which carries a password on the login route), or
 * for query values (which are the user's own data). Nothing is scrubbed afterwards,
 * because a scrub is a list someone can forget to extend.
 */
export function readErrorLogRequest(source: IErrorLogEventSource): IErrorLogRequest {
  const [path = '', query = ''] = source.path.split('?')
  const queryKeys = [...new Set(new URLSearchParams(query).keys())].sort()

  return {
    method: source.method,
    path,
    queryKeys,
    // The id, never the email — an id identifies the row to query, an email identifies a person
    userId: source.context.user?.id ?? null,
  }
}

/**
 * The error worth describing. h3 wraps anything foreign in an `H3Error` whose `name` is the
 * bare `Error`, keeping the original as `cause` — so reading through one level is what puts
 * `PrismaClientKnownRequestError` in the entry rather than a word that says nothing. Only
 * one level: deeper is a chain the thrower built, and its head is the one that was raised.
 */
function originOf(error: unknown): Error {
  if (isError(error) && error.cause instanceof Error) return error.cause
  return error instanceof Error ? error : new Error(String(error))
}

/** `now` is a parameter so the entry is deterministic and the spec needs no fake clock. */
export function buildErrorLogEntry(
  error: unknown,
  request: IErrorLogRequest | null,
  now: Date,
): IErrorLogEntry {
  const origin = originOf(error)

  return {
    timestamp: now.toISOString(),
    // The status is the response's, so it comes from the wrapper, not from what it wraps
    statusCode: isError(error) ? error.statusCode : null,
    name: origin.name,
    message: origin.message,
    stack: origin.stack ?? null,
    method: request?.method ?? null,
    path: request?.path ?? null,
    queryKeys: request?.queryKeys ?? null,
    userId: request?.userId ?? null,
  }
}

/**
 * NDJSON: one entry is one line, whatever its stack contains, because `JSON.stringify`
 * escapes the newlines inside it. A format that let an entry span lines would need a
 * multi-line rule in every reader downstream.
 */
export function formatErrorLogLine(entry: IErrorLogEntry): string {
  return `${JSON.stringify(entry)}\n`
}
