import process from 'node:process'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { reconcileFieldIndexes } from '#server/db/field-indexes'
import { hashPassword } from '#server/utils/auth'
import { compileDataset } from '~~/prisma/seed/compile'
import { idFor } from '~~/prisma/seed/ids'
import { SEED_TABLES } from '~~/prisma/seed/dataset'
import type { ICompiledTable } from '~~/prisma/seed/compile'

/**
 * Writes the demo workspace for one account, and touches nothing else.
 *
 * **The only destructive statement is a delete of that one user row** — the schema cascades from
 * `User` to its tables, fields and records, so a re-run replaces the demo and leaves every other
 * account on the database untouched. Deliberately not the `TRUNCATE` the integration suite uses:
 * this runs against the *development* database, which is exactly where a real account lives.
 *
 * Rows go in through Prisma rather than through the services, for two reasons. The services
 * cannot set `createdAt`/`updatedAt` — `@updatedAt` overwrites the second on any write — and a
 * `RELATION` cannot be created through them at all until its target's records exist, which the
 * self-relation on Tasks makes impossible in any order. Everything the services would have
 * *judged* still runs: see `compile.ts`.
 *
 * The two display counters are maintained by hand for the same reason `test/integration/seed.ts`
 * maintains them — they have no database default, and a table left behind at zero would hand the
 * next record created through the app a number a seeded row already holds.
 */

const DEMO_EMAIL = 'test@test.com'
const DEMO_PASSWORD = 'testtest'

function assertSeedableEnvironment(): void {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    throw new Error('DATABASE_URL is not set. Copy `.env.example` to `.env` first.')
  }

  // A demo account with a published password has no business existing on a production database,
  // whatever the connection string happens to say
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a demo account with NODE_ENV=production.')
  }
}

async function writeTable(userId: string, table: ICompiledTable): Promise<void> {
  await prisma.table.create({
    data: {
      id: table.id,
      userId,
      name: table.name,
      number: table.number,
      // The high-water mark the next record created through the app will read
      recordCounter: table.records.length,
    },
  })

  await prisma.field.createMany({
    data: table.fields.map((field) => ({
      id: field.id,
      tableId: table.id,
      name: field.name,
      key: field.key,
      type: field.type,
      required: field.required,
      options: (field.options as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
      order: field.order,
      indexed: field.indexed,
    })),
  })

  if (table.records.length === 0) return

  await prisma.record.createMany({
    data: table.records.map((record) => ({
      id: record.id,
      tableId: table.id,
      number: record.number,
      data: record.data as Prisma.InputJsonObject,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })),
  })
}

async function seed(): Promise<void> {
  assertSeedableEnvironment()

  // Compiled before the delete, so a dataset that does not validate costs nothing
  const tables = compileDataset(SEED_TABLES)

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } })

  const user = await prisma.user.create({
    data: {
      // Derived like every other seeded id, which buys one thing beyond reproducibility: a
      // session cookie carries the user id, so a re-seed leaves whoever is signed in signed in
      id: idFor(`user:${DEMO_EMAIL}`),
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      tableCounter: tables.length,
    },
    select: { id: true },
  })

  for (const table of tables) await writeTable(user.id, table)

  // Outside every write above, and unavoidably so: these are `CREATE INDEX CONCURRENTLY`, which
  // PostgreSQL refuses inside a transaction. Nothing else creates them for a directly inserted
  // field, so without this pass an `indexed` field would carry the flag and none of the indexes.
  const indexes = await reconcileFieldIndexes()

  const report = [
    `Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`,
    ...tables.map(
      (table) =>
        `  ${table.name.padEnd(18)} ${String(table.records.length).padStart(4)} records, ` +
        `${table.fields.length} fields`,
    ),
    `  ${'Indexes'.padEnd(18)} ${indexes.created.length} created, ${indexes.dropped.length} dropped` +
      (indexes.reaped.length > 0 ? `, ${indexes.reaped.length} reaped` : ''),
  ]

  // The one place in the project that writes to stdout on purpose: this is a command a person
  // runs and reads, not a request handler
  process.stdout.write(`${report.join('\n')}\n`)
}

try {
  await seed()
} finally {
  await prisma.$disconnect()
}
