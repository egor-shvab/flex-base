import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { retryOnPublicIdCollision } from '#server/db/workspaces'

const collisionOn = (column: string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.0',
    meta: { driverAdapterError: { cause: { constraint: { fields: [`"${column}"`] } } } },
  })

describe('retryOnPublicIdCollision', () => {
  it('runs once when nothing collides', async () => {
    const run = vi.fn().mockResolvedValue('done')

    await expect(retryOnPublicIdCollision(run)).resolves.toBe('done')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('reruns after a public id collision', async () => {
    const run = vi.fn().mockRejectedValueOnce(collisionOn('publicId')).mockResolvedValue('done')

    await expect(retryOnPublicIdCollision(run)).resolves.toBe('done')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('stops after three attempts and surfaces the last collision', async () => {
    const run = vi.fn().mockRejectedValue(collisionOn('publicId'))

    await expect(retryOnPublicIdCollision(run)).rejects.toMatchObject({ code: 'P2002' })
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('never retries another unique column, which a rerun would only hit again', async () => {
    const run = vi.fn().mockRejectedValue(collisionOn('email'))

    await expect(retryOnPublicIdCollision(run)).rejects.toMatchObject({ code: 'P2002' })
    expect(run).toHaveBeenCalledTimes(1)
  })
})
