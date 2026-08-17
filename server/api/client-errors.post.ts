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
 * Where the browser reports an error it raised, so the client half of the app stops being a blind
 * spot. The entry lands in the same NDJSON log as a server fault, tagged `"source":"client"`.
 *
 * **Deliberately unauthenticated.** An error on the login page is exactly the kind worth having,
 * so requiring a session would blind the endpoint to it. The auth middleware still runs, so a
 * signed-in report carries its user id — read from the cookie, never from the body.
 *
 * That makes this the app's only write surface open to anyone, and the two guards below are the
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
   * A missing length is refused too, and that is the load-bearing half: capping only the declared
   * length would leave chunked encoding as an uncapped path straight into memory. Every browser
   * `fetch` with a string body sets it.
   */
  const declaredLength = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
    throw createError({ statusCode: 411, statusMessage: 'Length required' })
  }
  if (declaredLength > CLIENT_ERROR_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Report too large' })
  }

  /**
   * Keyed on the socket address, **not** on `x-forwarded-for`: nothing here knows which proxies
   * to trust, and an attacker-controlled header would make the limit opt-out. Behind a proxy this
   * degrades to one shared allowance — too strict rather than bypassable, which is the right way
   * for a guard to fail.
   */
  if (!limiter.check(getRequestIP(event) ?? 'unknown', Date.now())) {
    throw createError({ statusCode: 429, statusMessage: 'Too many reports' })
  }

  const report = await readValidatedBody(event, clientErrorReportSchema.parse)

  recordErrorEntry(buildClientErrorLogEntry(report, event.context.user?.id ?? null, new Date()))

  return { ok: true }
})
