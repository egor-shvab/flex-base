import { defineEventHandler, getCookie } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { findAuthUser } from '#server/services/auth'
import { AUTH_COOKIE, verifyAuthToken } from '#server/utils/auth'

// Attaches the authenticated user to event.context.user on every request.
// Never rejects: unauthenticated requests pass through as anonymous and
// individual handlers decide via requireUser().
export default defineEventHandler(async (event) => {
  event.context.user = null

  const token = getCookie(event, AUTH_COOKIE)
  if (!token) return

  const userId = verifyAuthToken(token, useRuntimeConfig(event).jwtSecret)
  if (!userId) return

  event.context.user = await findAuthUser(userId)
})
