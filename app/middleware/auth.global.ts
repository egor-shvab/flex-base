import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { resolveSafeRedirect } from '~/utils/safe-redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // First navigation (SSR included): restore the session from the auth cookie
  if (!auth.initialized) {
    await auth.fetchUser()
  }

  // The component showcase renders fixtures only, so it is open to anyone. Exact-or-slash, so a
  // lookalike path such as `/ui-testing` stays guarded.
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
