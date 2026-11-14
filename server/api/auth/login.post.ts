import { defineEventHandler, readValidatedBody } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { AuthService } from '#server/services/auth'
import { setAuthCookie, signAuthToken } from '#server/utils/auth'
import { assertWithinRateLimit, createRateLimiter, toClientAddress } from '#server/utils/rate-limit'
import { credentialsInputSchema } from '#shared/validation/auth'
import type { IAuthUserResponse } from '#shared/types/api'

const SIGN_IN_WINDOW_MS = 15 * 60 * 1000
const TOO_MANY_ATTEMPTS = 'Too many sign-in attempts. Try again in 15 minutes'

const attemptsByAddress = createRateLimiter({
  limit: 100,
  windowMs: SIGN_IN_WINDOW_MS,
  maxKeys: 10_000,
})

/**
 * Per account as well, or guesses at one password spread over many addresses go unthrottled.
 * Lower-cased so case variants share an allowance. The cost: anyone can hold an account's sign-in
 * shut for one window.
 */
const attemptsByEmail = createRateLimiter({
  limit: 10,
  windowMs: SIGN_IN_WINDOW_MS,
  maxKeys: 10_000,
})

export default defineEventHandler(async (event): Promise<IAuthUserResponse> => {
  assertWithinRateLimit(attemptsByAddress, toClientAddress(event), TOO_MANY_ATTEMPTS)

  const credentials = await readValidatedBody(event, credentialsInputSchema.parse)

  assertWithinRateLimit(attemptsByEmail, credentials.email.toLowerCase(), TOO_MANY_ATTEMPTS)

  const user = await AuthService.authenticateUser(credentials)

  setAuthCookie(event, signAuthToken(user.id, useRuntimeConfig(event).jwtSecret))

  return { user }
})
