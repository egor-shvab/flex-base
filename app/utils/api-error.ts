import type { FetchError } from 'ofetch'

/**
 * Blank counts as absent. `??` alone skips only `null`/`undefined`, so a `statusMessage: ''`
 * used to win over a perfectly good `message` and render an empty error box. The type check
 * closes the same hole from the other side: `data` is untyped at runtime, and a non-string
 * message would otherwise be returned from a `string`-typed function.
 */
function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/** Nitro's `createError` puts the message on `data`; anything else gets a generic fallback. */
export function getApiErrorMessage(error: unknown): string {
  const data = (error as FetchError)?.data

  return (
    nonBlank(data?.statusMessage) ??
    nonBlank(data?.message) ??
    'Something went wrong. Please try again.'
  )
}

/**
 * Turns a failed page fetch into the error the boundary renders.
 *
 * Only a 404 tells us what was wrong — the table is missing or belongs to someone else. Every
 * other status reaching a page load is a request the server refused to read (a malformed
 * `?search=` or `?sort=` in a hand-edited link), so the code is forwarded but no cause is
 * asserted. Hard-coding "Table not found" here is what previously made a 400 render as a
 * server error claiming a table that had just loaded did not exist.
 */
export function toPageError(error: { statusCode?: number }): {
  statusCode: number
  statusMessage: string
} {
  const statusCode = error.statusCode ?? 404

  return {
    statusCode,
    statusMessage:
      statusCode === 404 ? 'We couldn’t find that table.' : 'That web address could not be read.',
  }
}
