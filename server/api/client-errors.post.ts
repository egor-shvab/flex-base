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

/**
 * Where the browser reports an error it raised. The entry lands in the same NDJSON log as a
 * server fault, tagged `"source":"client"`.
 *
 * **Deliberately unauthenticated** — an error on the login page is exactly the kind worth having.
 * The auth middleware still runs, so a signed-in report carries its user id, read from the
 * cookie and never from the body.
 *
 * That makes this the app's only write surface open to anyone, so the two guards below are the
 * substance of it rather than decoration.
 */
const limiter = createRateLimiter({
  limit: CLIENT_ERROR_RATE_LIMIT,
  windowMs: CLIENT_ERROR_RATE_WINDOW_MS,
  // Well past any real client count, and the map is cleared rather than grown past it
  maxKeys: 5_000,
})

export default defineEventHandler(async (event): Promise<IOkResponse> => {
  /**
   * Checked **before the stream is read**, so an oversized body is refused rather than buffered.
   * A missing length is refused too, and that is the load-bearing half: capping only a declared
   * length leaves chunked encoding as an uncapped path into memory.
   */
  const declaredLength = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
    throw createError({ statusCode: 411, statusMessage: 'Length required' })
  }
  if (declaredLength > CLIENT_ERROR_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Report too large' })
  }

  /**
   * Keyed on the socket address, **not** `x-forwarded-for`: nothing here knows which proxies to
   * trust, and an attacker-controlled header would make the limit opt-out. Behind a proxy it
   * degrades to one shared allowance — too strict rather than bypassable.
   */
  if (!limiter.check(getRequestIP(event) ?? 'unknown', Date.now())) {
    throw createError({ statusCode: 429, statusMessage: 'Too many reports' })
  }

  const report = await readValidatedBody(event, clientErrorReportSchema.parse)

  recordErrorEntry(buildClientErrorLogEntry(report, event.context.user?.id ?? null, new Date()))

  return { ok: true }
})
