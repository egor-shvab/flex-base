import type { FetchError } from 'ofetch'

/** Blank counts as absent, or a `statusMessage: ''` would win over a good `message`. */
function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

export function getApiErrorMessage(error: unknown): string {
  const data = (error as FetchError)?.data

  return (
    nonBlank(data?.statusMessage) ??
    nonBlank(data?.message) ??
    'Something went wrong. Please try again.'
  )
}

function pageErrorMessage(statusCode: number): string {
  if (statusCode === 404) return 'We couldn’t find that table.'
  if (statusCode >= 500) return 'Something went wrong at our end.'

  return 'That web address could not be read.'
}

export function toPageError(error: { statusCode?: number }): {
  statusCode: number
  statusMessage: string
} {
  const statusCode = error.statusCode ?? 404

  return { statusCode, statusMessage: pageErrorMessage(statusCode) }
}
