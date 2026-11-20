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
  UNMATCHED_PASSWORD_HASH: 'unmatched-hash',
}))

const CREDENTIALS = { email: 'ada@example.com', password: 'correct-horse' }
const REGISTRATION = { ...CREDENTIALS, name: 'Ada' }
const USER_ID = 'usr_1'

const authUser = { id: USER_ID, email: CREDENTIALS.email, name: 'Ada' }
const rowWithSession = { ...authUser, sessionVersion: 2 }
const rowWithHash = { ...rowWithSession, passwordHash: 'stored-hash' }
const signedIn = { user: authUser, sessionVersion: 2 }

/** Shaped as `@prisma/adapter-pg` reports it, quoting only a mixed-case column. */
const uniqueViolationOn = (column: string) =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: '7.9.0',
    meta: {
      driverAdapterError: {
        cause: {
          constraint: { fields: [column === column.toLowerCase() ? column : `"${column}"`] },
        },
      },
    },
  })

beforeEach(() => {
  resetPrismaMock()
  vi.mocked(hashPassword).mockResolvedValue('fresh-hash')
  vi.mocked(verifyPassword).mockReset()
})

describe('AuthService.registerUser', () => {
  const WORKSPACE = { id: 'wsp_1', publicId: 'k3f9x2m8qa', name: 'Personal workspace' }

  beforeEach(() => {
    prismaMock.user.create.mockResolvedValue({ id: USER_ID })
    prismaMock.workspace.create.mockResolvedValue({ id: WORKSPACE.id })
    prismaMock.workspaceMember.create.mockResolvedValue({ id: 'mem_1', workspace: WORKSPACE })
    prismaMock.user.update.mockResolvedValue(rowWithSession)
  })

  it('stores what hashPassword returned, never the password itself', async () => {
    await expect(AuthService.registerUser(REGISTRATION)).resolves.toEqual(signedIn)

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { email: CREDENTIALS.email, name: 'Ada', passwordHash: 'fresh-hash' },
      }),
    )
  })

  it('selects the user and the session version a token needs, never the hash', async () => {
    await AuthService.registerUser(REGISTRATION)

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, email: true, name: true, sessionVersion: true },
      }),
    )
  })

  it('creates the personal workspace in the same transaction, and remembers it', async () => {
    await AuthService.registerUser(REGISTRATION)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Personal workspace', ownerId: USER_ID }),
      }),
    )
    expect(prismaMock.workspaceMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: { connect: { id: USER_ID } },
          role: {
            connect: { workspaceId_name: { workspaceId: WORKSPACE.id, name: 'Admin' } },
          },
        }),
      }),
    )
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { lastWorkspaceId: WORKSPACE.id },
      }),
    )
  })

  it('runs no uniqueness pre-check — the insert is the check', async () => {
    await AuthService.registerUser(REGISTRATION)

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('reruns the whole transaction when the public id collides', async () => {
    prismaMock.workspace.create.mockRejectedValueOnce(uniqueViolationOn('publicId'))

    await expect(AuthService.registerUser(REGISTRATION)).resolves.toEqual(signedIn)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
  })

  it('gives up after three collisions rather than looping, and never blames the email', async () => {
    prismaMock.workspace.create.mockRejectedValue(uniqueViolationOn('publicId'))

    const error = await AuthService.registerUser(REGISTRATION).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toHaveProperty('statusCode')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3)
  })

  it('maps a duplicate email onto a 409, without retrying', async () => {
    prismaMock.user.create.mockRejectedValue(uniqueViolationOn('email'))

    await expect(AuthService.registerUser(REGISTRATION)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Email is already registered',
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
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

    const result = await AuthService.authenticateUser(CREDENTIALS)

    expect(result).toEqual(signedIn)
    expect(result.user).not.toHaveProperty('passwordHash')
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: CREDENTIALS.email },
      select: { id: true, email: true, name: true, sessionVersion: true, passwordHash: true },
    })
  })

  it('compares the submitted password against the stored hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(rowWithHash)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    await AuthService.authenticateUser(CREDENTIALS)

    expect(verifyPassword).toHaveBeenCalledWith(CREDENTIALS.password, 'stored-hash')
  })

  it('still pays a comparison for an unknown email, so its timing matches a wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    await expect(AuthService.authenticateUser(CREDENTIALS)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
    expect(verifyPassword).toHaveBeenCalledWith(CREDENTIALS.password, 'unmatched-hash')
  })

  it('refuses an unknown email even if the stand-in hash were to match', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    await expect(AuthService.authenticateUser(CREDENTIALS)).rejects.toMatchObject({
      statusCode: 401,
    })
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
  const session = { userId: USER_ID, sessionVersion: 2 }

  it('matches the token’s session version in the query, with the select that omits the hash', async () => {
    prismaMock.user.findFirst.mockResolvedValue(authUser)

    await expect(AuthService.findAuthUser(session)).resolves.toEqual(authUser)

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_ID, sessionVersion: 2 },
      select: { id: true, email: true, name: true },
    })
  })

  it('returns null when the row is gone or signed out since', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    await expect(AuthService.findAuthUser(session)).resolves.toBeNull()
  })
})

describe('AuthService.revokeSessions', () => {
  it('raises the caller’s own session version, without throwing on a vanished row', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 })

    await AuthService.revokeSessions(USER_ID)

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { sessionVersion: { increment: 1 } },
    })
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
