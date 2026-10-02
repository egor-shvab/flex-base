import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { authUserSelect, authUserWithHashSelect, toAuthUser } from '#server/db/users'
import { hashPassword, verifyPassword } from '#server/utils/auth'
import { toHttpError } from '#server/utils/http-errors'
import type { IAuthUser } from '#shared/types/auth'
import type { TCredentialsInput } from '#shared/validation/auth'

const authErrors = { conflict: 'Email is already registered' }

/** Same generic error for unknown email and wrong password — no user enumeration. */
const invalidCredentials = () =>
  createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

/**
 * The insert is the uniqueness check: a `findUnique` first would race. A duplicate also pays for
 * a hash before being refused, which closes the timing difference.
 */
async function registerUser({ email, password }: TCredentialsInput): Promise<IAuthUser> {
  const passwordHash = await hashPassword(password)

  try {
    return toAuthUser(
      await prisma.user.create({ data: { email, passwordHash }, select: authUserSelect }),
    )
  } catch (error) {
    throw toHttpError(error, authErrors)
  }
}

async function authenticateUser({ email, password }: TCredentialsInput): Promise<IAuthUser> {
  const user = await prisma.user.findUnique({ where: { email }, select: authUserWithHashSelect })
  if (!user) throw invalidCredentials()

  if (!(await verifyPassword(password, user.passwordHash))) throw invalidCredentials()

  return toAuthUser(user)
}

async function findAuthUser(userId: string): Promise<IAuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: authUserSelect })

  return user ? toAuthUser(user) : null
}

export const AuthService = {
  registerUser,
  authenticateUser,
  findAuthUser,
}
