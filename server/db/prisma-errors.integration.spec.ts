import { describe, expect, it } from 'vitest'
import { prisma } from '#server/db/prisma'
import { isUniqueViolationOn } from '#server/db/prisma-errors'
import { createUser } from '~~/test/integration/seed'

// The column list is read from an undocumented corner of the adapter's error: only a real
// violation proves it is still there, and without it the public id retry silently stops
describe('isUniqueViolationOn, against the real driver adapter', () => {
  it('names the column of a colliding workspace address', async () => {
    const taken = await createUser()
    const other = await createUser()

    const error = await prisma.workspace
      .update({
        where: { id: other.workspace.id },
        data: { publicId: taken.workspace.publicId },
      })
      .catch((thrown: unknown) => thrown)

    expect(isUniqueViolationOn(error, 'publicId')).toBe(true)
    expect(isUniqueViolationOn(error, 'email')).toBe(false)
  })

  it('names the column of a taken email', async () => {
    const taken = await createUser()

    const error = await prisma.user
      .create({ data: { email: taken.email, name: 'Twin', passwordHash: 'not-a-real-hash' } })
      .catch((thrown: unknown) => thrown)

    expect(isUniqueViolationOn(error, 'email')).toBe(true)
    expect(isUniqueViolationOn(error, 'publicId')).toBe(false)
  })
})
