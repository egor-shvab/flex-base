import type { FetchError } from 'ofetch'
import type { INotFoundData } from '#shared/types/api'

/** Blank counts as absent, or a `statusMessage: ''` would win over a good `message`. */
function toNonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

export function getApiErrorMessage(error: unknown): string {
  const data = (error as FetchError)?.data

  return (
    toNonBlank(data?.statusMessage) ??
    toNonBlank(data?.message) ??
    'Something went wrong. Please try again.'
  )
}

export interface IHttpFailure {
  statusCode?: number
  data?: unknown
}

/**
 * A 404 the server marked as the workspace's: not a member, or no such workspace. Read from the
 * marker, never the message.
 */
export function isWorkspaceMissing(error: unknown): boolean {
  const failure = error as IHttpFailure | null | undefined

  return failure?.statusCode === 404 && hasWorkspaceMarker(failure.data)
}

function hasWorkspaceMarker(data: unknown): boolean {
  return (data as { data?: Partial<INotFoundData> } | undefined)?.data?.missing === 'workspace'
}

function formatPageErrorMessage(statusCode: number, isWorkspace: boolean): string {
  if (statusCode === 404) {
    return isWorkspace ? 'We couldn’t find that workspace.' : 'We couldn’t find that table.'
  }
  if (statusCode >= 500) return 'Something went wrong at our end.'

  return 'That web address could not be read.'
}

/**
 * Fatal, or a client-side navigation leaves the previous page on screen: Nuxt shows its error page
 * on the client only for a fatal error.
 */
export function toPageError(error: IHttpFailure): {
  statusCode: number
  statusMessage: string
  fatal: true
} {
  const statusCode = error.statusCode ?? 404

  return {
    statusCode,
    statusMessage: formatPageErrorMessage(statusCode, hasWorkspaceMarker(error.data)),
    fatal: true,
  }
}
