import { defineEventHandler, readValidatedBody } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { AuthService } from '#server/services/auth'
import { setAuthCookie, signAuthToken } from '#server/utils/auth'
import { registrationInputSchema } from '#shared/validation/auth'
import type { IAuthUserResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IAuthUserResponse> => {
  const input = await readValidatedBody(event, registrationInputSchema.parse)

  const user = await AuthService.registerUser(input)

  setAuthCookie(event, signAuthToken(user.id, useRuntimeConfig(event).jwtSecret))

  return { user }
})
