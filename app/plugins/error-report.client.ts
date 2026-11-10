import { defineNuxtPlugin } from '#imports'
import { useErrorsApi } from '~/api/errors'
import { CLIENT_ERROR_LIMITS, CLIENT_ERROR_REPORTS_PER_PAGE } from '#shared/constants/error-report'
import type { TClientErrorReport } from '#shared/validation/client-error'

/**
 * Reports browser errors to the error log. `.client` on purpose: during SSR a Vue error already
 * reaches Nitro's `error` hook.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const api = useErrorsApi()

  let sent = 0

  function describe(error: unknown): Pick<TClientErrorReport, 'name' | 'message' | 'stack'> {
    if (error instanceof Error) {
      return { name: error.name || 'Error', message: error.message, stack: error.stack }
    }

    return { name: 'UnknownError', message: String(error) }
  }

  function clamp(value: string, limit: number): string {
    return value.slice(0, limit)
  }

  function report(error: unknown): void {
    if (sent >= CLIENT_ERROR_REPORTS_PER_PAGE) return
    sent += 1

    const { name, message, stack } = describe(error)

    void api
      .report({
        name: clamp(name, CLIENT_ERROR_LIMITS.name),
        message: clamp(message, CLIENT_ERROR_LIMITS.message),
        stack: stack === undefined ? undefined : clamp(stack, CLIENT_ERROR_LIMITS.stack),
        // Never `search` or `hash`, which carry the user's filters and open record
        path: clamp(window.location.pathname, CLIENT_ERROR_LIMITS.path),
      })
      // The loop breaker: a rejection here would be reported, fail, and report again forever
      .catch(() => {})
  }

  nuxtApp.hook('vue:error', (error) => report(error))

  window.addEventListener('unhandledrejection', (event) => report(event.reason))
})
