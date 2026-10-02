import type { Prisma } from '#server/generated/prisma/client'
import type { IAuthUser } from '#shared/types/auth'

export const authUserSelect = {
  id: true,
  email: true,
} satisfies Prisma.UserSelect

export const authUserWithHashSelect = {
  ...authUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect

export type TAuthUserRow = Prisma.UserGetPayload<{ select: typeof authUserSelect }>
export type TAuthUserWithHashRow = Prisma.UserGetPayload<{ select: typeof authUserWithHashSelect }>

export function toAuthUser(row: TAuthUserRow): IAuthUser {
  return { id: row.id, email: row.email }
}
