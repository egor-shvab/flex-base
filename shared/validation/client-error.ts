import { z } from 'zod'
import { CLIENT_ERROR_LIMITS } from '#shared/constants/error-report'

/**
 * One error a browser is reporting about itself.
 *
 * **What is absent is the design.** No `userId` — the auth middleware has already put the
 * cookie's user on the event, so a caller cannot claim to be someone else. No query string, no
 * headers, no application state: `path` is a pathname, and the handler strips anything from `?`
 * onward, so a query **value** cannot arrive by being pasted into it. That keeps the redaction
 * structural rather than a scrub (`docs/decisions.md`).
 */
export const clientErrorReportSchema = z.object({
  name: z.string().trim().min(1).max(CLIENT_ERROR_LIMITS.name),
  message: z.string().trim().max(CLIENT_ERROR_LIMITS.message),
  stack: z.string().max(CLIENT_ERROR_LIMITS.stack).optional(),
  /** Where the user was. Rooted, so an absolute URL to another origin cannot be logged as a path. */
  path: z.string().max(CLIENT_ERROR_LIMITS.path).startsWith('/'),
})

export type TClientErrorReport = z.infer<typeof clientErrorReportSchema>
