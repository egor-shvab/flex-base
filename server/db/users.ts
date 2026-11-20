import type { Prisma } from '#server/generated/prisma/client'
import type { IAuthUser, IUserRef } from '#shared/types/auth'

export const authUserSelect = {
  id: true,
  email: true,
  name: true,
} satisfies Prisma.UserSelect

export const authUserWithSessionSelect = {
  ...authUserSelect,
  sessionVersion: true,
} satisfies Prisma.UserSelect

export const authUserWithHashSelect = {
  ...authUserWithSessionSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect

export const userRefSelect = {
  id: true,
  name: true,
} satisfies Prisma.UserSelect

export type TAuthUserRow = Prisma.UserGetPayload<{ select: typeof authUserSelect }>
export type TAuthUserWithSessionRow = Prisma.UserGetPayload<{
  select: typeof authUserWithSessionSelect
}>
export type TAuthUserWithHashRow = Prisma.UserGetPayload<{ select: typeof authUserWithHashSelect }>
export type TUserRefRow = Prisma.UserGetPayload<{ select: typeof userRefSelect }>

export function toAuthUser(row: TAuthUserRow): IAuthUser {
  return { id: row.id, email: row.email, name: row.name }
}

/** A user just authenticated, with the session version their new token must carry. */
export interface ISignedInUser {
  user: IAuthUser
  sessionVersion: number
}

export function toSignedInUser(row: TAuthUserWithSessionRow): ISignedInUser {
  return { user: toAuthUser(row), sessionVersion: row.sessionVersion }
}

export function toUserRef(row: TUserRefRow | null): IUserRef | null {
  return row ? { id: row.id, name: row.name } : null
}
