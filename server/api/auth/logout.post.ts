import { defineEventHandler } from 'h3'
import { clearAuthCookie } from '#server/utils/auth'
import type { IOkResponse } from '#shared/types/api'

export default defineEventHandler((event): IOkResponse => {
  clearAuthCookie(event)
  return { ok: true }
})
