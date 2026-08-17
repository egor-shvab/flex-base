import { z } from 'zod'
import { CLIENT_ERROR_LIMITS } from '#shared/constants/error-report'

/**
 * One error a browser is reporting about itself.
 *
 * **What is absent is the design.** There is no `userId` — the auth middleware has already put the
 * cookie's user on the event, so the server attaches it and a caller cannot claim to be someone
 * else. There is no query string, no headers and no application state: `path` is a pathname, and
 * the handler strips anything from `?` onward before recording, so a query **value** cannot arrive
 * by being pasted into it. That keeps the redaction structural rather than a scrub, which is the
 * property the server's own error log is built on (`docs/decisions.md`).
 */
export const clientErrorReportSchema = z.object({
  name: z.string().trim().min(1).max(CLIENT_ERROR_LIMITS.name),
  message: z.string().trim().max(CLIENT_ERROR_LIMITS.message),
  stack: z.string().max(CLIENT_ERROR_LIMITS.stack).optional(),
  /** Where the user was. Rooted, so an absolute URL to another origin cannot be logged as a path. */
  path: z.string().max(CLIENT_ERROR_LIMITS.path).startsWith('/'),
})

export type TClientErrorReport = z.infer<typeof clientErrorReportSchema>
