import { z } from 'zod'
import { CLIENT_ERROR_LIMITS } from '#shared/constants/error-report'

/**
 * What is absent is the design: no `userId` (the middleware resolves it from the cookie) and no
 * query string, headers or state, so redaction is structural rather than a scrub.
 */
export const clientErrorReportSchema = z.object({
  name: z.string().trim().min(1).max(CLIENT_ERROR_LIMITS.name),
  message: z.string().trim().max(CLIENT_ERROR_LIMITS.message),
  stack: z.string().max(CLIENT_ERROR_LIMITS.stack).optional(),
  /** Rooted, so an absolute URL to another origin cannot be logged as a path. */
  path: z.string().max(CLIENT_ERROR_LIMITS.path).startsWith('/'),
})

export type TClientErrorReport = z.infer<typeof clientErrorReportSchema>
