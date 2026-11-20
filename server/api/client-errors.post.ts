import { createError, defineEventHandler, getRequestHeader, readValidatedBody } from 'h3'
import { buildClientErrorLogEntry } from '#server/utils/error-log'
import { recordErrorEntry } from '#server/utils/error-log-file'
import { assertWithinRateLimit, createRateLimiter, toClientAddress } from '#server/utils/rate-limit'
import { assertBodyWithin } from '#server/utils/request-body'
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
  // A report always has a body, so here a missing length is refused outright
  const declaredLength = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
    throw createError({ statusCode: 411, statusMessage: 'Length required' })
  }
  assertBodyWithin(event, CLIENT_ERROR_MAX_BYTES, 'Report too large')

  assertWithinRateLimit(limiter, toClientAddress(event), 'Too many reports')

  const report = await readValidatedBody(event, clientErrorReportSchema.parse)

  recordErrorEntry(buildClientErrorLogEntry(report, event.context.user?.id ?? null, new Date()))

  return { ok: true }
})
