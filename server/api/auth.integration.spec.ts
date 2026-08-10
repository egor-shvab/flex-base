import { describe, expect, it } from 'vitest'
import login from '#server/api/auth/login.post'
import logout from '#server/api/auth/logout.post'
import me from '#server/api/auth/me.get'
import register from '#server/api/auth/register.post'
import authMiddleware from '#server/middleware/auth'
import { AUTH_COOKIE, signAuthToken } from '#server/utils/auth'
import { prisma } from '#server/utils/prisma'
import { cookieHeader, testEvent } from '~~/test/integration/event'
import { createUser } from '~~/test/integration/seed'

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse' }

const post = (body: unknown) => testEvent({ method: 'POST', body })

/** The token a Set-Cookie header carries, for feeding back into the middleware. */
function tokenFrom(header: string): string {
  return header.split(';')[0]?.split('=')[1] ?? ''
}

describe('registering', () => {
  it('creates the account and returns it without the hash', async () => {
    const event = post(CREDENTIALS)

    const result = await register(event)

    expect(result.user).toEqual({ id: expect.any(String), email: CREDENTIALS.email })
    expect(JSON.stringify(result)).not.toContain('passwordHash')
  })

  it('stores a hash rather than the password', async () => {
    await register(post(CREDENTIALS))

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: CREDENTIALS.email } })

    expect(stored.passwordHash).not.toBe(CREDENTIALS.password)
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/)
  })

  it('signs the visitor in on the spot', async () => {
    const event = post(CREDENTIALS)
    await register(event)

    expect(cookieHeader(event)).toContain(`${AUTH_COOKIE}=`)
    expect(cookieHeader(event)).toContain('HttpOnly')
  })

  it('409s on an email already registered, without touching the existing row', async () => {
    await register(post(CREDENTIALS))
    const first = await prisma.user.findUniqueOrThrow({ where: { email: CREDENTIALS.email } })

    await expect(
      register(post({ ...CREDENTIALS, password: 'different-password' })),
    ).rejects.toMatchObject({ statusCode: 409, statusMessage: 'Email is already registered' })

    const after = await prisma.user.findUniqueOrThrow({ where: { email: CREDENTIALS.email } })
    expect(after.passwordHash).toBe(first.passwordHash)
  })

  it('400s on a password under the floor, creating nothing', async () => {
    await expect(register(post({ ...CREDENTIALS, password: 'short' }))).rejects.toMatchObject({
      statusCode: 400,
    })

    await expect(prisma.user.count()).resolves.toBe(0)
  })

  it('400s on a malformed email', async () => {
    await expect(register(post({ ...CREDENTIALS, email: 'not-an-email' }))).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})

/**
 * Both failure modes answer identically on purpose: a different message or status for "no such
 * account" would turn the login form into an account-existence oracle.
 */
describe('logging in', () => {
  it('accepts the right password and sets the cookie', async () => {
    await register(post(CREDENTIALS))

    const event = post(CREDENTIALS)
    const result = await login(event)

    expect(result.user.email).toBe(CREDENTIALS.email)
    expect(cookieHeader(event)).toContain(`${AUTH_COOKIE}=`)
  })

  it('never returns the hash', async () => {
    await register(post(CREDENTIALS))

    expect(JSON.stringify(await login(post(CREDENTIALS)))).not.toContain('passwordHash')
  })

  it('answers a wrong password and an unknown email the same way', async () => {
    await register(post(CREDENTIALS))

    const wrongPassword = await login(post({ ...CREDENTIALS, password: 'wrong-horse' })).catch(
      (error: unknown) => error,
    )
    const unknownEmail = await login(
      post({ email: 'nobody@example.com', password: CREDENTIALS.password }),
    ).catch((error: unknown) => error)

    expect(wrongPassword).toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
    expect(unknownEmail).toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  })

  it('sets no cookie when it fails', async () => {
    await register(post(CREDENTIALS))

    const event = post({ ...CREDENTIALS, password: 'wrong-horse' })
    await expect(login(event)).rejects.toBeDefined()

    expect(cookieHeader(event)).toBe('')
  })
})

describe('the session endpoints', () => {
  it('reports the user the middleware attached', async () => {
    const user = await createUser()
    const event = testEvent({ user })

    expect(await me(event)).toEqual({ user })
  })

  /** Synchronous, so it throws rather than returning a rejected promise. */
  it('401s for an anonymous caller', () => {
    expect(() => me(testEvent())).toThrow(expect.objectContaining({ statusCode: 401 }))
  })

  it('expires the cookie on logout', async () => {
    const event = testEvent({ method: 'POST' })

    expect(await logout(event)).toEqual({ ok: true })
    expect(cookieHeader(event)).toContain('Max-Age=0')
  })
})

/**
 * The middleware never rejects — it attaches whoever the cookie proves and lets each handler
 * decide. Every path below therefore ends in a `context.user`, not in an error.
 */
describe('the auth middleware', () => {
  it('attaches the user a valid token names', async () => {
    const registration = post(CREDENTIALS)
    await register(registration)
    const token = tokenFrom(cookieHeader(registration))

    const event = testEvent()
    event.node.req.headers.cookie = `${AUTH_COOKIE}=${token}`
    await authMiddleware(event)

    expect(event.context.user).toMatchObject({ email: CREDENTIALS.email })
  })

  it('leaves a request with no cookie anonymous', async () => {
    const event = testEvent()
    await authMiddleware(event)

    expect(event.context.user).toBeNull()
  })

  it('leaves a malformed token anonymous rather than failing the request', async () => {
    const event = testEvent()
    event.node.req.headers.cookie = `${AUTH_COOKIE}=not.a.token`
    await authMiddleware(event)

    expect(event.context.user).toBeNull()
  })

  it('leaves a token signed with another secret anonymous', async () => {
    const user = await createUser()
    const event = testEvent()
    event.node.req.headers.cookie = `${AUTH_COOKIE}=${signAuthToken(user.id, 'a-different-secret')}`
    await authMiddleware(event)

    expect(event.context.user).toBeNull()
  })

  /** A validly signed token for an account that has since been deleted must not authenticate. */
  it('leaves a token for a deleted user anonymous', async () => {
    const user = await createUser()
    const token = signAuthToken(user.id, process.env.JWT_SECRET ?? '')
    await prisma.user.delete({ where: { id: user.id } })

    const event = testEvent()
    event.node.req.headers.cookie = `${AUTH_COOKIE}=${token}`
    await authMiddleware(event)

    expect(event.context.user).toBeNull()
  })

  it('never exposes the hash on the attached user', async () => {
    const registration = post(CREDENTIALS)
    await register(registration)

    const event = testEvent()
    event.node.req.headers.cookie = `${AUTH_COOKIE}=${tokenFrom(cookieHeader(registration))}`
    await authMiddleware(event)

    expect(event.context.user).not.toHaveProperty('passwordHash')
  })
})
