import { defineNitroPlugin } from 'nitropack/runtime'
import {
  buildErrorLogEntry,
  isLoggableServerError,
  readErrorLogRequest,
} from '#server/utils/error-log'
import { recordErrorEntry } from '#server/utils/error-log-file'

/**
 * The one place server errors are recorded. Nitro's `error` hook is reached from h3's `onError`,
 * so it sees every route handler, the auth middleware and the SSR renderer alike — no handler
 * opts in, and none may log for itself.
 *
 * It cannot affect a response: `captureError` calls the hook off the response path and catches
 * its rejections. **Do not make this handler async and do not await it anywhere** — that
 * guarantee is why the sink can be this blunt.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!isLoggableServerError(error)) return

    const request = event ? readErrorLogRequest(event) : null
    recordErrorEntry(buildErrorLogEntry(error, request, new Date()))
  })
})
