import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { prisma } from '#server/utils/prisma'
import { setAuthCookie, signAuthToken, verifyPassword } from '#server/utils/auth'
import { credentialsSchema } from '#shared/validation/auth'

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, credentialsSchema.parse)

  // Same generic error for unknown email and wrong password — no user enumeration
  const invalidCredentials = () =>
    createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw invalidCredentials()

  const passwordValid = await verifyPassword(password, user.passwordHash)
  if (!passwordValid) throw invalidCredentials()

  setAuthCookie(event, signAuthToken(user.id, useRuntimeConfig(event).jwtSecret))

  return { user: { id: user.id, email: user.email } }
})
