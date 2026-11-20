import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { isUniqueViolationOn } from '#server/db/prisma-errors'
import {
  authUserSelect,
  authUserWithHashSelect,
  authUserWithSessionSelect,
  toAuthUser,
  toSignedInUser,
  type ISignedInUser,
} from '#server/db/users'
import {
  PERSONAL_WORKSPACE_NAME,
  createWorkspaceWithOwner,
  retryOnPublicIdCollision,
} from '#server/db/workspaces'
import {
  hashPassword,
  UNMATCHED_PASSWORD_HASH,
  verifyPassword,
  type IAuthSession,
} from '#server/utils/auth'
import type { IAuthUser } from '#shared/types/auth'
import type { TCredentialsInput, TProfileInput, TRegistrationInput } from '#shared/validation/auth'

/** Same generic error for unknown email and wrong password — no user enumeration. */
const buildInvalidCredentialsError = () =>
  createError({ statusCode: 401, statusMessage: 'Invalid email or password' })

/**
 * The insert is the uniqueness check: a `findUnique` first would race. A duplicate also pays for
 * a hash before being refused, which closes the timing difference.
 */
async function registerUser({ email, password, name }: TRegistrationInput): Promise<ISignedInUser> {
  const passwordHash = await hashPassword(password)

  try {
    return toSignedInUser(
      await retryOnPublicIdCollision(() =>
        prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email, name, passwordHash },
            select: { id: true },
          })
          const membership = await createWorkspaceWithOwner(tx, {
            ownerId: user.id,
            name: PERSONAL_WORKSPACE_NAME,
          })

          return tx.user.update({
            where: { id: user.id },
            data: { lastWorkspaceId: membership.workspace.id },
            select: authUserWithSessionSelect,
          })
        }),
      ),
    )
  } catch (error) {
    // The email alone: a public id that kept colliding is our fault, not a taken address
    if (isUniqueViolationOn(error, 'email')) {
      throw createError({ statusCode: 409, statusMessage: 'Email is already registered' })
    }
    throw error
  }
}

async function authenticateUser({ email, password }: TCredentialsInput): Promise<ISignedInUser> {
  const user = await prisma.user.findUnique({ where: { email }, select: authUserWithHashSelect })
  const isPasswordValid = await verifyPassword(
    password,
    user?.passwordHash ?? UNMATCHED_PASSWORD_HASH,
  )

  if (!user || !isPasswordValid) throw buildInvalidCredentialsError()

  return toSignedInUser(user)
}

/** The version is in the `where`: a token issued before the last sign-out matches no row. */
async function findAuthUser({ userId, sessionVersion }: IAuthSession): Promise<IAuthUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, sessionVersion },
    select: authUserSelect,
  })

  return user ? toAuthUser(user) : null
}

/** Every token the user holds stops passing, on every device. */
async function revokeSessions(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  })
}

async function updateProfile(userId: string, { name }: TProfileInput): Promise<IAuthUser> {
  return toAuthUser(
    await prisma.user.update({ where: { id: userId }, data: { name }, select: authUserSelect }),
  )
}

export const AuthService = {
  registerUser,
  authenticateUser,
  findAuthUser,
  revokeSessions,
  updateProfile,
}
