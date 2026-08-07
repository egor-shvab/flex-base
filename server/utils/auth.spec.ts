import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signAuthToken, verifyAuthToken } from '#server/utils/auth'

const SECRET = 'test-secret-not-a-real-one'
const OTHER_SECRET = 'a-different-secret'
const USER_ID = 'usr_abc123'

/**
 * `hashPassword` / `verifyPassword` are deliberately not tested here: bcrypt at the configured
 * cost is ~100 ms per call, and a test over them would assert that bcrypt works rather than
 * anything this module decides. The cookie helpers need an `H3Event`, which is integration
 * territory. What is left is the part that can fail *open*.
 */

afterEach(() => {
  vi.useRealTimers()
})

describe('signAuthToken / verifyAuthToken', () => {
  it('round-trips the user id', () => {
    expect(verifyAuthToken(signAuthToken(USER_ID, SECRET), SECRET)).toBe(USER_ID)
  })

  it('issues a different token per user', () => {
    expect(signAuthToken(USER_ID, SECRET)).not.toBe(signAuthToken('usr_other', SECRET))
  })
})

describe('verifyAuthToken — rejection', () => {
  it('rejects a token signed with another secret', () => {
    expect(verifyAuthToken(signAuthToken(USER_ID, OTHER_SECRET), SECRET)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const [header, , signature] = signAuthToken(USER_ID, SECRET).split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'usr_admin' })).toString('base64url')

    expect(verifyAuthToken(`${header}.${forgedPayload}.${signature}`, SECRET)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = signAuthToken(USER_ID, SECRET)

    expect(verifyAuthToken(`${token}x`, SECRET)).toBeNull()
  })

  it('rejects malformed input rather than throwing', () => {
    for (const token of ['', 'not-a-token', 'a.b.c', '...']) {
      expect(verifyAuthToken(token, SECRET)).toBeNull()
    }
  })

  it('rejects a token carrying no subject', () => {
    // A valid signature is not enough — the id is the whole point of the token
    expect(verifyAuthToken(jwt.sign({}, SECRET, { algorithm: 'HS256' }), SECRET)).toBeNull()
  })

  it('rejects a token whose payload is a bare string', () => {
    expect(verifyAuthToken(jwt.sign('usr_abc123', SECRET), SECRET)).toBeNull()
  })
})

describe('verifyAuthToken — the algorithm pin', () => {
  it('rejects a token signed with a different HMAC algorithm', () => {
    // `algorithms: ['HS256']` is what stops a caller choosing the algorithm for us
    const forged = jwt.sign({}, SECRET, { subject: USER_ID, algorithm: 'HS512' })

    expect(forged.length).toBeGreaterThan(0)
    expect(verifyAuthToken(forged, SECRET)).toBeNull()
  })

  it('rejects an unsigned `alg: none` token', () => {
    const forged = jwt.sign({ sub: USER_ID }, '', { algorithm: 'none' })

    expect(verifyAuthToken(forged, SECRET)).toBeNull()
  })
})

describe('verifyAuthToken — expiry', () => {
  it('accepts a token inside its lifetime', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = signAuthToken(USER_ID, SECRET)

    vi.setSystemTime(new Date('2026-01-06T00:00:00Z')) // +5 days, inside the 7-day TTL
    expect(verifyAuthToken(token, SECRET)).toBe(USER_ID)
  })

  it('rejects a token past its lifetime', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = signAuthToken(USER_ID, SECRET)

    vi.setSystemTime(new Date('2026-01-09T00:00:00Z')) // +8 days
    expect(verifyAuthToken(token, SECRET)).toBeNull()
  })
})
