import { createError, defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { toPageError, type IHttpFailure } from '~/utils/api-error'
import { resolveSafeRedirect } from '~/utils/safe-redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (!auth.isInitialized) {
    try {
      await auth.fetchUser()
    } catch (error) {
      // No answer is a 503: the page cannot tell yet whether the visitor is signed in
      return createError(toPageError({ statusCode: (error as IHttpFailure).statusCode ?? 503 }))
    }
  }

  // Fixtures only, so public. Exact-or-slash, so `/ui-testing` stays guarded
  if (to.path === '/ui-test' || to.path.startsWith('/ui-test/')) return

  const isAuthRoute = to.path.startsWith('/auth')

  if (!auth.isAuthenticated && !isAuthRoute) {
    return navigateTo({
      path: '/auth/login',
      query: to.fullPath === '/' ? {} : { redirect: to.fullPath },
    })
  }

  if (auth.isAuthenticated && isAuthRoute) {
    return navigateTo(resolveSafeRedirect(to.query.redirect))
  }
})
