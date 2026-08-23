import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { authenticateUser, findAuthUser, registerUser } from '#server/services/auth'
import { hashPassword, verifyPassword } from '#server/utils/auth'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

/**
 * Only the two symbols the service imports, rather than `importOriginal`: bcrypt's own
 * behaviour is `server/utils/auth.spec.ts`'s, and that the column really holds a bcrypt hash is
 * `server/api/auth.integration.spec.ts`'s. What is left here is which function is called with
 * what — and a spy says that far more directly than a real hash at cost 10.
 */
vi.mock('#server/utils/auth', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse' }
const USER_ID = 'usr_1'

const authUser = { id: USER_ID, email: CREDENTIALS.email }
const rowWithHash = { ...authUser, passwordHash: 'stored-hash' }

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7.9.0' })

beforeEach(() => {
  resetPrismaMock()
  vi.mocked(hashPassword).mockResolvedValue('fresh-hash')
  vi.mocked(verifyPassword).mockReset()
})

describe('registerUser', () => {
  it('stores what hashPassword returned, never the password itself', async () => {
    prismaMock.user.create.mockResolvedValue(authUser)

    await expect(registerUser(CREDENTIALS)).resolves.toEqual(authUser)

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { email: CREDENTIALS.email, passwordHash: 'fresh-hash' },
      }),
    )
  })

  it('selects only id and email, so the hash cannot reach a response', async () => {
    prismaMock.user.create.mockResolvedValue(authUser)

    await registerUser(CREDENTIALS)

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, email: true } }),
    )
  })

  /**
   * The race fix, and the only place it can be asserted: a database proves the constraint
   * fires, but only the argument proves nothing looked first.
   */
  it('runs no uniqueness pre-check — the insert is the check', async () => {
    prismaMock.user.create.mockResolvedValue(authUser)

    await registerUser(CREDENTIALS)

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('maps a duplicate email onto a 409', async () => {
    prismaMock.user.create.mockRejectedValue(conflict())

    await expect(registerUser(CREDENTIALS)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Email is already registered',
    })
  })

  it('passes an unrecognised failure through, so it still surfaces as a 500', async () => {
    prismaMock.user.create.mockRejectedValue(new Error('connection reset'))

    const error = await registerUser(CREDENTIALS).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ message: 'connection reset' })
    expect(error).not.toHaveProperty('statusCode')
  })
})

describe('authenticateUser', () => {
  it('reads the hash-bearing select and returns the user without it', async () => {
    prismaMock.user.findUnique.mockResolvedValue(rowWithHash)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    const user = await authenticateUser(CREDENTIALS)

    expect(user).toEqual(authUser)
    expect(user).not.toHaveProperty('passwordHash')
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: CREDENTIALS.email },
      select: { id: true, email: true, passwordHash: true },
    })
  })

  it('compares the submitted password against the stored hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(rowWithHash)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    await authenticateUser(CREDENTIALS)

    expect(verifyPassword).toHaveBeenCalledWith(CREDENTIALS.password, 'stored-hash')
  })

  it('answers an unknown email with a 401, without a password to compare', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(authenticateUser(CREDENTIALS)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
    expect(verifyPassword).not.toHaveBeenCalled()
  })

  /** A different status or message here would make the login form an account-existence oracle. */
  it('answers a wrong password identically to an unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(rowWithHash)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    await expect(authenticateUser(CREDENTIALS)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  })
})

describe('findAuthUser', () => {
  it('reads by id with the select that omits the hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(authUser)

    await expect(findAuthUser(USER_ID)).resolves.toEqual(authUser)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true, email: true },
    })
  })

  /** The deleted-account path: a validly signed token must not authenticate a missing row. */
  it('returns null when the row is gone', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(findAuthUser(USER_ID)).resolves.toBeNull()
  })
})
