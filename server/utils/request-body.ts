import { createError, getRequestHeader } from 'h3'
import type { H3Event } from 'h3'

/** Far above any record or field a form can send, far below what buffering would hurt. */
export const REQUEST_BODY_MAX_BYTES = 1024 * 1024

/**
 * Judged from the headers, before anything is read: Node stops a body at its declared length, so
 * the declaration is the cap. Chunked encoding declares none and is refused, or it would be an
 * uncapped path into memory.
 */
export function assertBodyWithin(event: H3Event, maxBytes: number, statusMessage: string): void {
  const declaredLength = getRequestHeader(event, 'content-length')

  if (declaredLength === undefined) {
    if (getRequestHeader(event, 'transfer-encoding') !== undefined) {
      throw createError({ statusCode: 411, statusMessage: 'Length required' })
    }
    return
  }

  if (Number(declaredLength) > maxBytes) {
    throw createError({ statusCode: 413, statusMessage })
  }
}
