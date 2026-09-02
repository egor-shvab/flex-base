import { afterAll, beforeEach } from 'vitest'
import { prisma } from '#server/db/prisma'

/**
 * A clean database before every case. `TRUNCATE … CASCADE` rather than deleting per model:
 * it is one statement, it does not care about foreign-key order, and it resets nothing the
 * schema depends on — every id is a cuid rather than a sequence.
 *
 * `User` alone would cascade to the rest, but naming all four keeps a case that seeds only a
 * table (no user) just as clean.
 */
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "User", "Table", "Field", "Record" CASCADE')
})

afterAll(async () => {
  await prisma.$disconnect()
})
