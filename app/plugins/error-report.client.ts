import { defineNuxtPlugin } from '#imports'
import { useErrorsApi } from '~/api/errors'
import { CLIENT_ERROR_LIMITS, CLIENT_ERROR_REPORTS_PER_PAGE } from '#shared/constants/error-report'
import type { TClientErrorReport } from '#shared/validation/client-error'

/**
 * The browser half of the error log. Until this existed the client was a blind spot: a render
 * error or a rejected promise reached the user and nobody else.
 *
 * **`.client` on purpose** — during SSR a Vue error already reaches Nitro's `error` hook, which
 * records it as a server fault. Reporting it from here as well would log one failure twice.
 *
 * The plugin body is a valid setup context, so `useErrorsApi()` is resolved **here** and its
 * function called later from the handlers — the same shape `useTableLoader` uses, and what keeps
 * the URL in `app/api/paths.ts` rather than in this file.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const api = useErrorsApi()

  /**
   * A render loop raises the same error every frame, so a page is allowed a handful of reports
   * and no more. Deliberately not reset on navigation: it is a per-load ceiling on how much one
   * broken build can write, not a quota anyone should be spending.
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
        // The pathname alone — never `search` or `hash`, which carry the user's own filters and
        // the record they have open. The server cuts a query off this too, but not sending one
        // is the half that does not rely on the other end being careful.
        path: clamp(window.location.pathname, CLIENT_ERROR_LIMITS.path),
      })
      // **This catch is the loop breaker, not tidiness.** An uncaught rejection here would be
      // caught by the listener below, reported, fail again, and report again — forever. Nothing
      // is logged in its place: there is nowhere left to report a failure to report.
      .catch(() => {})
  }

  // A Vue error that reached the top — a render, a lifecycle hook, a watcher
  nuxtApp.hook('vue:error', (error) => report(error))

  // A rejected promise nobody caught, which is where a failed fetch outside a `try` ends up
  window.addEventListener('unhandledrejection', (event) => report(event.reason))
})
