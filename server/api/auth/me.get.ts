import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'

export default defineEventHandler((event) => {
  const user = requireUser(event)
  return { user }
})
