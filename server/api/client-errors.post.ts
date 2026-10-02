import {
  createError,
  defineEventHandler,
  getRequestHeader,
  getRequestIP,
  readValidatedBody,
} from 'h3'
import { buildClientErrorLogEntry } from '#server/utils/error-log'
import { recordErrorEntry } from '#server/utils/error-log-file'
import { createRateLimiter } from '#server/utils/rate-limit'
import {
  CLIENT_ERROR_MAX_BYTES,
  CLIENT_ERROR_RATE_LIMIT,
  CLIENT_ERROR_RATE_WINDOW_MS,
} from '#shared/constants/error-report'
import type { IOkResponse } from '#shared/types/api'
import { clientErrorReportSchema } from '#shared/validation/client-error'

const limiter = createRateLimiter({
  limit: CLIENT_ERROR_RATE_LIMIT,
  windowMs: CLIENT_ERROR_RATE_WINDOW_MS,
  maxKeys: 5_000,
})

export default defineEventHandler(async (event): Promise<IOkResponse> => {
  /**
   * Checked before the body is read. A missing length is refused too, or chunked encoding is an
   * uncapped path into memory.
   */
  const declaredLength = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
    throw createError({ statusCode: 411, statusMessage: 'Length required' })
  }
  if (declaredLength > CLIENT_ERROR_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Report too large' })
  }

  /**
   * Keyed on the socket address, not `x-forwarded-for`, which an attacker controls. Behind a proxy
   * this degrades to one shared allowance — too strict rather than bypassable.
   */
  if (!limiter.check(getRequestIP(event) ?? 'unknown', Date.now())) {
    throw createError({ statusCode: 429, statusMessage: 'Too many reports' })
  }

  const report = await readValidatedBody(event, clientErrorReportSchema.parse)

  recordErrorEntry(buildClientErrorLogEntry(report, event.context.user?.id ?? null, new Date()))

  return { ok: true }
})
