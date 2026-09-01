import { defineNuxtPlugin } from '#imports'
import { useErrorsApi } from '~/api/errors'
import { CLIENT_ERROR_LIMITS, CLIENT_ERROR_REPORTS_PER_PAGE } from '#shared/constants/error-report'
import type { TClientErrorReport } from '#shared/validation/client-error'

/**
 * The browser half of the error log: without it a render error or a rejected promise reaches
 * the user and nobody else.
 *
 * **`.client` on purpose** — during SSR a Vue error already reaches Nitro's `error` hook, so
 * reporting from here too would log one failure twice.
 *
 * The plugin body is a valid setup context, so `useErrorsApi()` is resolved **here** and called
 * later from the handlers — which is what keeps the URL in `app/api/paths.ts`.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const api = useErrorsApi()

  /**
   * A render loop raises the same error every frame, so a page is allowed a handful of reports
   * and no more. Not reset on navigation: a per-load ceiling, not a quota to spend.
   */
  let sent = 0

  /** Whatever was thrown, as the three strings the report carries. */
  function describe(error: unknown): Pick<TClientErrorReport, 'name' | 'message' | 'stack'> {
    if (error instanceof Error) {
      // A name is required and an anonymous subclass can leave it empty
      return { name: error.name || 'Error', message: error.message, stack: error.stack }
    }

    // A thrown string, or an object with no `Error` in its prototype chain
    return { name: 'UnknownError', message: String(error) }
  }

  /** Truncated to what the schema accepts, so an over-long stack loses its tail, not the report. */
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
        // The pathname alone — never `search` or `hash`, which carry the user's filters and the
        // record they have open. The server strips a query too; not sending one is the half
        // that does not rely on the other end being careful.
        path: clamp(window.location.pathname, CLIENT_ERROR_LIMITS.path),
      })
      // **The loop breaker, not tidiness.** An uncaught rejection here would be caught by the
      // listener below, reported, fail, and report again forever. Nothing is logged in its
      // place: there is nowhere left to report a failure to report.
      .catch(() => {})
  }

  // A Vue error that reached the top — a render, a lifecycle hook, a watcher
  nuxtApp.hook('vue:error', (error) => report(error))

  // A rejected promise nobody caught, which is where a failed fetch outside a `try` ends up
  window.addEventListener('unhandledrejection', (event) => report(event.reason))
})
