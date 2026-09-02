import type { FetchError } from 'ofetch'

/**
 * Blank counts as absent: `??` alone skips only `null`/`undefined`, so a `statusMessage: ''`
 * would win over a good `message` and render an empty error box. The type check closes the same
 * hole from the other side, since `data` is untyped at runtime.
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

/** The one place each status's wording is decided — `app/error.vue` renders what this returns. */
function pageErrorMessage(statusCode: number): string {
  if (statusCode === 404) return 'We couldn’t find that table.'
  if (statusCode >= 500) return 'Something went wrong at our end.'

  return 'That web address could not be read.'
}

/**
 * Turns a failed page fetch into the error the boundary renders.
 *
 * Three answers, because three things can go wrong. A **404** names its cause — the table is
 * missing or belongs to someone else. A **5xx** is a fault at our end, and saying so matters:
 * the records page wraps its record fetch in the same `useAsyncData`, so a failing endpoint
 * reaches here and must not read as a bad link. Everything else is a request the server refused
 * to read — a malformed `?search=` or `?sort=` — so the code is forwarded and no cause asserted.
 * Hard-coding a cause here makes a 400 claim a table that had just loaded does not exist.
 */
export function toPageError(error: { statusCode?: number }): {
  statusCode: number
  statusMessage: string
} {
  const statusCode = error.statusCode ?? 404

  return { statusCode, statusMessage: pageErrorMessage(statusCode) }
}
