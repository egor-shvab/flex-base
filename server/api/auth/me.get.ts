import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import type { IAuthUserResponse } from '#shared/types/api'

export default defineEventHandler((event): IAuthUserResponse => {
  const user = requireUser(event)
  return { user }
})
