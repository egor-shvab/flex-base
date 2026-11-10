import { describe, expect, it } from 'vitest'
import { AuthService } from '#server/services/auth'
import { prisma } from '#server/db/prisma'

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse' }

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
    expect(rejected[0]?.reason).toMatchObject({
      statusCode: 409,
      statusMessage: 'Email is already registered',
    })
    await expect(prisma.user.count()).resolves.toBe(1)
  })
})

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
