import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import jwt from 'jsonwebtoken'
import { createEvent, getResponseHeader, type H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertJwtSecret,
  AUTH_COOKIE,
  clearAuthCookie,
  hashPassword,
  requireUser,
  setAuthCookie,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
} from '#server/utils/auth'

const SECRET = 'test-secret-not-a-real-one'
const OTHER_SECRET = 'a-different-secret'
const USER_ID = 'usr_abc123'
const SESSION = { userId: USER_ID, sessionVersion: 3 }

function testEvent(): H3Event {
  const request = new IncomingMessage(new Socket())
  return createEvent(request, new ServerResponse(request))
}

function setCookieHeader(event: H3Event): string {
  return String(getResponseHeader(event, 'set-cookie') ?? '')
}

afterEach(() => {
  vi.useRealTimers()
})

describe('assertJwtSecret', () => {
  it('refuses to start without a secret, rather than failing at the first sign-in', () => {
    expect(() => assertJwtSecret('')).toThrow(/NUXT_JWT_SECRET/)
  })

  it('refuses a secret short enough to guess', () => {
    expect(() => assertJwtSecret('a'.repeat(31))).toThrow(/at least 32/)
  })

  it('accepts 32 characters, and never echoes the secret back', () => {
    expect(() => assertJwtSecret('a'.repeat(32))).not.toThrow()
    expect(() => assertJwtSecret('short-secret')).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('short-secret') }),
    )
  })
})

describe('signAuthToken / verifyAuthToken', () => {
  it('round-trips the user id and the session version', () => {
    expect(verifyAuthToken(signAuthToken(SESSION, SECRET), SECRET)).toEqual(SESSION)
  })

  it('issues a different token per user and per session version', () => {
    const token = signAuthToken(SESSION, SECRET)

    expect(token).not.toBe(signAuthToken({ ...SESSION, userId: 'usr_other' }, SECRET))
    expect(token).not.toBe(signAuthToken({ ...SESSION, sessionVersion: 4 }, SECRET))
  })
})

describe('verifyAuthToken — rejection', () => {
  it('rejects a token signed with another secret', () => {
    expect(verifyAuthToken(signAuthToken(SESSION, OTHER_SECRET), SECRET)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const [header, , signature] = signAuthToken(SESSION, SECRET).split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'usr_admin' })).toString('base64url')

    expect(verifyAuthToken(`${header}.${forgedPayload}.${signature}`, SECRET)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = signAuthToken(SESSION, SECRET)

    expect(verifyAuthToken(`${token}x`, SECRET)).toBeNull()
  })

  it('rejects malformed input rather than throwing', () => {
    for (const token of ['', 'not-a-token', 'a.b.c', '...']) {
      expect(verifyAuthToken(token, SECRET)).toBeNull()
    }
  })

  it('rejects a token carrying no subject', () => {
    expect(verifyAuthToken(jwt.sign({}, SECRET, { algorithm: 'HS256' }), SECRET)).toBeNull()
  })

  it('rejects a token issued before sessions carried a version', () => {
    const legacy = jwt.sign({}, SECRET, { subject: USER_ID, algorithm: 'HS256' })

    expect(verifyAuthToken(legacy, SECRET)).toBeNull()
  })

  it('rejects a version that is not a whole number', () => {
    for (const ver of ['3', 1.5, null]) {
      const token = jwt.sign({ ver }, SECRET, { subject: USER_ID, algorithm: 'HS256' })
      expect(verifyAuthToken(token, SECRET)).toBeNull()
    }
  })

  it('rejects a token whose payload is a bare string', () => {
    expect(verifyAuthToken(jwt.sign('usr_abc123', SECRET), SECRET)).toBeNull()
  })
})

describe('verifyAuthToken — the algorithm pin', () => {
  it('rejects a token signed with a different HMAC algorithm', () => {
    const forged = jwt.sign({ ver: 3 }, SECRET, { subject: USER_ID, algorithm: 'HS512' })

    expect(forged.length).toBeGreaterThan(0)
    expect(verifyAuthToken(forged, SECRET)).toBeNull()
  })

  it('rejects an unsigned `alg: none` token', () => {
    const forged = jwt.sign({ sub: USER_ID, ver: 3 }, '', { algorithm: 'none' })

    expect(verifyAuthToken(forged, SECRET)).toBeNull()
  })
})

describe('verifyAuthToken — expiry', () => {
  it('accepts a token inside its lifetime', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = signAuthToken(SESSION, SECRET)

    vi.setSystemTime(new Date('2026-01-06T00:00:00Z'))
    expect(verifyAuthToken(token, SECRET)).toEqual(SESSION)
  })

  it('rejects a token past its lifetime', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = signAuthToken(SESSION, SECRET)

    vi.setSystemTime(new Date('2026-01-09T00:00:00Z'))
    expect(verifyAuthToken(token, SECRET)).toBeNull()
  })
})

describe('setAuthCookie', () => {
  it('writes the token under the auth cookie name', () => {
    const event = testEvent()
    setAuthCookie(event, 'a.b.c')

    expect(setCookieHeader(event)).toContain(`${AUTH_COOKIE}=a.b.c`)
  })

  it('keeps it out of reach of scripts', () => {
    const event = testEvent()
    setAuthCookie(event, 'a.b.c')

    expect(setCookieHeader(event)).toContain('HttpOnly')
  })

  it('sends it on same-site navigations only', () => {
    const event = testEvent()
    setAuthCookie(event, 'a.b.c')

    expect(setCookieHeader(event)).toContain('SameSite=Lax')
  })

  it('scopes it to the whole app and expires it with the token', () => {
    const event = testEvent()
    setAuthCookie(event, 'a.b.c')

    const header = setCookieHeader(event)
    expect(header).toContain('Path=/')
    expect(header).toContain(`Max-Age=${60 * 60 * 24 * 7}`)
  })
})

describe('clearAuthCookie', () => {
  it('expires the cookie on the same path it was set on, or the browser keeps it', () => {
    const event = testEvent()
    clearAuthCookie(event)

    const header = setCookieHeader(event)
    expect(header).toContain(`${AUTH_COOKIE}=`)
    expect(header).toContain('Path=/')
    expect(header).toContain('Max-Age=0')
  })
})

describe('requireUser', () => {
  it('hands back the user the middleware attached', () => {
    const event = testEvent()
    event.context.user = { id: USER_ID, email: 'ada@example.com', name: 'Ada' }

    expect(requireUser(event)).toEqual({ id: USER_ID, email: 'ada@example.com', name: 'Ada' })
  })

  it('is the one place a 401 comes from', () => {
    const event = testEvent()
    event.context.user = null

    expect(() => requireUser(event)).toThrow(expect.objectContaining({ statusCode: 401 }))
  })
})

describe('hashPassword / verifyPassword', () => {
  it('round-trips a password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery')

    expect(hash).not.toBe('correct horse battery')
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true)
    await expect(verifyPassword('Correct horse battery', hash)).resolves.toBe(false)
  })
})
