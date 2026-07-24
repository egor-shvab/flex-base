import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import type { IAuthUser } from '#shared/types/auth'

declare module 'h3' {
  interface H3EventContext {
    user: IAuthUser | null
  }
}

export const AUTH_COOKIE = 'auth_token'
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
const BCRYPT_COST = 10

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signAuthToken(userId: string, secret: string): string {
  return jwt.sign({}, secret, {
    subject: userId,
    algorithm: 'HS256',
    expiresIn: AUTH_TOKEN_TTL_SECONDS,
  })
}

/** Returns the user id from a valid token, or null for any invalid/expired token. */
export function verifyAuthToken(token: string, secret: string): string | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (typeof payload === 'string' || !payload.sub) return null
    return payload.sub
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
