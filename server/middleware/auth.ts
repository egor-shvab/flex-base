// Attaches the authenticated user to event.context.user on every request.
// Never rejects: unauthenticated requests pass through as anonymous and
// individual handlers decide via requireUser().
export default defineEventHandler(async (event) => {
  event.context.user = null

  const token = getCookie(event, AUTH_COOKIE)
  if (!token) return

  const userId = verifyAuthToken(token, useRuntimeConfig(event).jwtSecret)
  if (!userId) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })

  event.context.user = user
})
