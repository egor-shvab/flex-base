import type { FetchError } from 'ofetch'

/** Nitro's `createError` puts the message on `data`; anything else gets a generic fallback. */
export function getApiErrorMessage(error: unknown): string {
  const fetchError = error as FetchError

  return (
    fetchError?.data?.statusMessage ??
    fetchError?.data?.message ??
    'Something went wrong. Please try again.'
  )
}
