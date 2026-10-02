import { defineNitroPlugin } from 'nitropack/runtime'
import {
  buildErrorLogEntry,
  isLoggableServerError,
  readErrorLogRequest,
} from '#server/utils/error-log'
import { recordErrorEntry } from '#server/utils/error-log-file'

/**
 * Records every server error, so no handler logs for itself. Do not make this handler async or
 * await it: `captureError` running it off the response path is why the sink can be this blunt.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!isLoggableServerError(error)) return

    const request = event ? readErrorLogRequest(event) : null
    recordErrorEntry(buildErrorLogEntry(error, request, new Date()))
  })
})
