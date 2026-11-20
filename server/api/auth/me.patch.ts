import { defineEventHandler, readValidatedBody } from 'h3'
import { AuthService } from '#server/services/auth'
import { requireUser } from '#server/utils/auth'
import { profileInputSchema } from '#shared/validation/auth'
import type { IAuthUserResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IAuthUserResponse> => {
  const user = requireUser(event)
  const input = await readValidatedBody(event, profileInputSchema.parse)

  return { user: await AuthService.updateProfile(user.id, input) }
})
