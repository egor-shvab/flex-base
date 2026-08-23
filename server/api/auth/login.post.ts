import { defineEventHandler, readValidatedBody } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { AuthService } from '#server/services/auth'
import { setAuthCookie, signAuthToken } from '#server/utils/auth'
import { credentialsInputSchema } from '#shared/validation/auth'
import type { IAuthUserResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IAuthUserResponse> => {
  const credentials = await readValidatedBody(event, credentialsInputSchema.parse)

  const user = await AuthService.authenticateUser(credentials)

  setAuthCookie(event, signAuthToken(user.id, useRuntimeConfig(event).jwtSecret))

  return { user }
})
