export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // First navigation (SSR included): restore the session from the auth cookie
  if (!auth.initialized) {
    await auth.fetchUser()
  }

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
