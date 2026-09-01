import { describe, expect, it } from 'vitest'
import { AuthService } from '#server/services/auth'
import { prisma } from '#server/db/prisma'

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse' }

/**
 * The handler spec already covers a *sequential* duplicate. What only a real index can answer is
 * what happens when two registrations for one email overlap — the case a `findUnique` pre-check
 * loses, by letting both requests past the check and both into the insert.
 */
describe('registration is arbitrated by the unique index, not by a pre-check', () => {
  it('lets exactly one of two concurrent registrations win', async () => {
    const results = await Promise.allSettled([
      AuthService.registerUser(CREDENTIALS),
      AuthService.registerUser(CREDENTIALS),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    // The loser is a 409, not the unmapped 500 the pre-check produced
    expect(rejected[0]?.reason).toMatchObject({
      statusCode: 409,
      statusMessage: 'Email is already registered',
    })
    await expect(prisma.user.count()).resolves.toBe(1)
  })
})

/**
 * `test/integration/seed.ts` writes `passwordHash: 'not-a-real-hash'`, so a sign-in case has to
 * register through the service — which is the point here: the hash bcrypt actually wrote has to
 * verify against the password that produced it, through a real row.
 */
describe('a password hashed at registration verifies at sign-in', () => {
  it('accepts the password it was registered with', async () => {
    const registered = await AuthService.registerUser(CREDENTIALS)

    await expect(AuthService.authenticateUser(CREDENTIALS)).resolves.toEqual(registered)
  })

  it('refuses a wrong password against the same row', async () => {
    await AuthService.registerUser(CREDENTIALS)

    await expect(
      AuthService.authenticateUser({ ...CREDENTIALS, password: 'wrong-horse' }),
    ).rejects.toMatchObject({ statusCode: 401, statusMessage: 'Invalid email or password' })
  })

  it('never carries the hash out of the service', async () => {
    const user = await AuthService.registerUser(CREDENTIALS)

    expect(JSON.stringify(user)).not.toContain('passwordHash')
    expect(
      await prisma.user.findUniqueOrThrow({ where: { email: CREDENTIALS.email } }),
    ).toMatchObject({
      passwordHash: expect.stringMatching(/^\$2[aby]\$/),
    })
  })
})
