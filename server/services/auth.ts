import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { authUserSelect, authUserWithHashSelect, toAuthUser } from '#server/db/users'
import { hashPassword, verifyPassword } from '#server/utils/auth'
import { toHttpError } from '#server/utils/http-errors'
import type { IAuthUser } from '#shared/types/auth'
import type { TCredentialsInput } from '#shared/validation/auth'

const authErrors = {
  conflict: 'Email is already registered',
  // Required by the shared mapping, unreachable here: `create` raises P2002, never P2025.
  notFound: 'Account not found',
}

/** Same generic error for unknown email and wrong password — no user enumeration. */
const invalidCredentials = () =>
  createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

/**
 * **The insert is the uniqueness check.** A `findUnique` first is the same time-of-check
 * TOCTOU shape as fetching a row before testing its owner: two requests for one email both see
 * nothing, both insert, and the index refuses the loser as an unmapped 500. The cost is that a
 * duplicate now pays for a hash before being refused — which also closes the timing difference
 * a pre-check gave away (`docs/decisions.md`).
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

/**
 * The one read that needs `passwordHash`, which is why it is the only caller of
 * `authUserWithHashSelect` and narrows through `toAuthUser` on the way out.
 */
async function authenticateUser({ email, password }: TCredentialsInput): Promise<IAuthUser> {
  const user = await prisma.user.findUnique({ where: { email }, select: authUserWithHashSelect })
  if (!user) throw invalidCredentials()

  if (!(await verifyPassword(password, user.passwordHash))) throw invalidCredentials()

  return toAuthUser(user)
}

/**
 * Null rather than a 404: the middleware never rejects, it leaves the caller anonymous. A
 * validly signed token still has to name a row that exists, or a deleted account authenticates.
 */
async function findAuthUser(userId: string): Promise<IAuthUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: authUserSelect })

  return user ? toAuthUser(user) : null
}

export const AuthService = {
  registerUser,
  authenticateUser,
  findAuthUser,
}
