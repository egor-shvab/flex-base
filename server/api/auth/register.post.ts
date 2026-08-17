import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import { prisma } from '#server/db/prisma'
import { hashPassword, setAuthCookie, signAuthToken } from '#server/utils/auth'
import { credentialsInputSchema } from '#shared/validation/auth'
import type { IAuthUserResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IAuthUserResponse> => {
  const { email, password } = await readValidatedBody(event, credentialsInputSchema.parse)

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
    select: { id: true, email: true },
  })

  setAuthCookie(event, signAuthToken(user.id, useRuntimeConfig(event).jwtSecret))

  return { user }
})
