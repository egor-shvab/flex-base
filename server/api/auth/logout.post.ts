import { defineEventHandler } from 'h3'
import { clearAuthCookie } from '#server/utils/auth'

export default defineEventHandler((event) => {
  clearAuthCookie(event)
  return { ok: true }
})
