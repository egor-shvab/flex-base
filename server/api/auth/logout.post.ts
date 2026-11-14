import { defineEventHandler } from 'h3'
import { AuthService } from '#server/services/auth'
import { clearAuthCookie } from '#server/utils/auth'
import type { IOkResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IOkResponse> => {
  const user = event.context.user
  if (user) await AuthService.revokeSessions(user.id)

  clearAuthCookie(event)
  return { ok: true }
})
