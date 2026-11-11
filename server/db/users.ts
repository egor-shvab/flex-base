import type { Prisma } from '#server/generated/prisma/client'
import type { IAuthUser, IUserRef } from '#shared/types/auth'

export const authUserSelect = {
  id: true,
  email: true,
  name: true,
} satisfies Prisma.UserSelect

export const authUserWithHashSelect = {
  ...authUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect

export const userRefSelect = {
  id: true,
  name: true,
} satisfies Prisma.UserSelect

export type TAuthUserRow = Prisma.UserGetPayload<{ select: typeof authUserSelect }>
export type TAuthUserWithHashRow = Prisma.UserGetPayload<{ select: typeof authUserWithHashSelect }>
export type TUserRefRow = Prisma.UserGetPayload<{ select: typeof userRefSelect }>

export function toAuthUser(row: TAuthUserRow): IAuthUser {
  return { id: row.id, email: row.email, name: row.name }
}

export function toUserRef(row: TUserRefRow | null): IUserRef | null {
  return row ? { id: row.id, name: row.name } : null
}
