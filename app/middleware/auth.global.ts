import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { resolveSafeRedirect } from '~/utils/safe-redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchUser()
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
