import type { Prisma } from '#server/generated/prisma/client'
import type { IAuthUser } from '#shared/types/auth'

/** Never `passwordHash` — the shape every layer above the database speaks (`CLAUDE.md` §5). */
export const authUserSelect = {
  id: true,
  email: true,
} satisfies Prisma.UserSelect

/** The same plus the one column a password check needs, and the only select that names it. */
export const authUserWithHashSelect = {
  ...authUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect

export type TAuthUserRow = Prisma.UserGetPayload<{ select: typeof authUserSelect }>
export type TAuthUserWithHashRow = Prisma.UserGetPayload<{ select: typeof authUserWithHashSelect }>

/**
 * The one place the hash is dropped. A row read with `authUserWithHashSelect` is structurally
 * assignable here, so "a user row never leaves with its hash" is a property of this function
 * rather than of every call site that has to remember to narrow.
 */
export function toAuthUser(row: TAuthUserRow): IAuthUser {
  return { id: row.id, email: row.email }
}
