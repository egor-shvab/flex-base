import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createError, deleteCookie, setCookie } from 'h3'
import type { H3Event } from 'h3'
import type { IAuthUser } from '#shared/types/auth'

declare module 'h3' {
  interface H3EventContext {
    user: IAuthUser | null
  }
}

export const AUTH_COOKIE = 'auth_token'
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
const BCRYPT_COST = 10
const JWT_SECRET_MIN_LENGTH = 32

/** Run at start-up: an empty secret fails only at the first sign-in, a short one can be guessed. */
export function assertJwtSecret(secret: string): void {
  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(
      `NUXT_JWT_SECRET must be set to at least ${JWT_SECRET_MIN_LENGTH} characters of random text`,
    )
  }
}

/**
 * No one's password, hashed at the same cost: compared against when no user matches, so an unknown
 * email takes as long as a wrong password and the timing does not say which it was.
 */
export const UNMATCHED_PASSWORD_HASH = bcrypt.hashSync('unmatched-password', BCRYPT_COST)

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Who a token speaks for, and the `User.sessionVersion` it was issued under. */
export interface IAuthSession {
  userId: string
  sessionVersion: number
}

export function signAuthToken({ userId, sessionVersion }: IAuthSession, secret: string): string {
  return jwt.sign({ ver: sessionVersion }, secret, {
    subject: userId,
    algorithm: 'HS256',
    expiresIn: AUTH_TOKEN_TTL_SECONDS,
  })
}

/**
 * Only proves the signature. Whether the session still stands is the user row's to say: a token
 * whose `ver` is behind `User.sessionVersion` was signed out. One without a `ver` predates
 * revocation and is refused.
 */
export function verifyAuthToken(token: string, secret: string): IAuthSession | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (typeof payload === 'string' || !payload.sub) return null

    const sessionVersion: unknown = payload.ver
    if (typeof sessionVersion !== 'number' || !Number.isInteger(sessionVersion)) return null

    return { userId: payload.sub, sessionVersion }
  } catch {
    return null
  }
}

export function setAuthCookie(event: H3Event, token: string): void {
  setCookie(event, AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: AUTH_TOKEN_TTL_SECONDS,
  })
}

export function clearAuthCookie(event: H3Event): void {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
}

export function requireUser(event: H3Event): IAuthUser {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return user
}
