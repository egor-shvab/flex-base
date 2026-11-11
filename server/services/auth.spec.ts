import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { AuthService } from '#server/services/auth'
import { hashPassword, verifyPassword } from '#server/utils/auth'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

vi.mock('#server/utils/auth', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse' }
const REGISTRATION = { ...CREDENTIALS, name: 'Ada' }
const USER_ID = 'usr_1'

const authUser = { id: USER_ID, email: CREDENTIALS.email, name: 'Ada' }
const rowWithHash = { ...authUser, passwordHash: 'stored-hash' }

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7.9.0' })

beforeEach(() => {
  resetPrismaMock()
  vi.mocked(hashPassword).mockResolvedValue('fresh-hash')
  vi.mocked(verifyPassword).mockReset()
})

describe('AuthService.registerUser', () => {
  it('stores what hashPassword returned, never the password itself', async () => {
    prismaMock.user.create.mockResolvedValue(authUser)

    await expect(AuthService.registerUser(REGISTRATION)).resolves.toEqual(authUser)

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { email: CREDENTIALS.email, name: 'Ada', passwordHash: 'fresh-hash' },
      }),
    )
  })

  it('selects only id, email and name, so the hash cannot reach a response', async () => {
    prismaMock.user.create.mockResolvedValue(authUser)

    await AuthService.registerUser(REGISTRATION)

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, email: true, name: true } }),
    )
  })

  it('runs no uniqueness pre-check — the insert is the check', async () => {
    prismaMock.user.create.mockResolvedValue(authUser)

    await AuthService.registerUser(REGISTRATION)

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('maps a duplicate email onto a 409', async () => {
    prismaMock.user.create.mockRejectedValue(conflict())

    await expect(AuthService.registerUser(REGISTRATION)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Email is already registered',
    })
  })

  it('passes an unrecognised failure through, so it still surfaces as a 500', async () => {
    prismaMock.user.create.mockRejectedValue(new Error('connection reset'))

    const error = await AuthService.registerUser(REGISTRATION).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ message: 'connection reset' })
    expect(error).not.toHaveProperty('statusCode')
  })
})

describe('AuthService.authenticateUser', () => {
  it('reads the hash-bearing select and returns the user without it', async () => {
    prismaMock.user.findUnique.mockResolvedValue(rowWithHash)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    const user = await AuthService.authenticateUser(CREDENTIALS)

    expect(user).toEqual(authUser)
    expect(user).not.toHaveProperty('passwordHash')
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: CREDENTIALS.email },
      select: { id: true, email: true, name: true, passwordHash: true },
    })
  })

  it('compares the submitted password against the stored hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(rowWithHash)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    await AuthService.authenticateUser(CREDENTIALS)

    expect(verifyPassword).toHaveBeenCalledWith(CREDENTIALS.password, 'stored-hash')
  })

  it('answers an unknown email with a 401, without a password to compare', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(AuthService.authenticateUser(CREDENTIALS)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
    expect(verifyPassword).not.toHaveBeenCalled()
  })

  it('answers a wrong password identically to an unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(rowWithHash)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    await expect(AuthService.authenticateUser(CREDENTIALS)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  })
})

describe('AuthService.findAuthUser', () => {
  it('reads by id with the select that omits the hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(authUser)

    await expect(AuthService.findAuthUser(USER_ID)).resolves.toEqual(authUser)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true, email: true, name: true },
    })
  })

  it('returns null when the row is gone', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(AuthService.findAuthUser(USER_ID)).resolves.toBeNull()
  })
})

describe('AuthService.updateProfile', () => {
  it("updates only the caller's own row, with the select that omits the hash", async () => {
    prismaMock.user.update.mockResolvedValue({ ...authUser, name: 'Ada Lovelace' })

    await expect(AuthService.updateProfile(USER_ID, { name: 'Ada Lovelace' })).resolves.toEqual({
      ...authUser,
      name: 'Ada Lovelace',
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { name: 'Ada Lovelace' },
      select: { id: true, email: true, name: true },
    })
  })
})
