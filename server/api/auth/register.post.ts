import { defineEventHandler, readValidatedBody } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { AuthService } from '#server/services/auth'
import { setAuthCookie, signAuthToken } from '#server/utils/auth'
import { assertWithinRateLimit, createRateLimiter, toClientAddress } from '#server/utils/rate-limit'
import { registrationInputSchema } from '#shared/validation/auth'
import type { IAuthUserResponse } from '#shared/types/api'

/** Each account also creates a workspace with its roles, and widens every per-user allowance. */
const registrationsByAddress = createRateLimiter({
  limit: 30,
  windowMs: 60 * 60 * 1000,
  maxKeys: 10_000,
})

export default defineEventHandler(async (event): Promise<IAuthUserResponse> => {
  assertWithinRateLimit(
    registrationsByAddress,
    toClientAddress(event),
    'Too many accounts created from this address. Try again in an hour',
  )

  const input = await readValidatedBody(event, registrationInputSchema.parse)

  const user = await AuthService.registerUser(input)

  setAuthCookie(event, signAuthToken(user.id, useRuntimeConfig(event).jwtSecret))

  return { user }
})
