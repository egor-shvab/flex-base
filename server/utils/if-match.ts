import { createError, getRequestHeader } from 'h3'
import type { H3Event } from 'h3'

/**
 * `If-Match` carries the `updatedAt` the client last read, as an ISO timestamp in quotes. Absent is
 * an unconditional write; anything else that is not a timestamp is a 400, never a silent pass.
 */
export function parseIfMatchVersion(header: string | undefined): Date | undefined {
  if (header === undefined || header.trim() === '') return undefined

  const version = new Date(header.trim().replace(/^W\//, '').replace(/^"|"$/g, ''))
  if (Number.isNaN(version.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'If-Match must be a version timestamp' })
  }

  return version
}

export function readIfMatchVersion(event: H3Event): Date | undefined {
  return parseIfMatchVersion(getRequestHeader(event, 'if-match'))
}
