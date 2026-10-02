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
 * The only destructive statement deletes one user row, never a `TRUNCATE`: this runs against the
 * development database. The display counters are set by hand, having no database default.
 */

const DEMO_EMAIL = 'test@test.com'
const DEMO_PASSWORD = 'testtest'

function assertSeedableEnvironment(): void {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    throw new Error('DATABASE_URL is not set. Copy `.env.example` to `.env` first.')
  }

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

  const tables = compileDataset(SEED_TABLES)

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } })

  const user = await prisma.user.create({
    data: {
      id: idFor(`user:${DEMO_EMAIL}`),
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      tableCounter: tables.length,
    },
    select: { id: true },
  })

  for (const table of tables) await writeTable(user.id, table)

  // `CONCURRENTLY` is refused inside a transaction, and nothing else indexes a directly inserted
  // field
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

  process.stdout.write(`${report.join('\n')}\n`)
}

try {
  await seed()
} finally {
  await prisma.$disconnect()
}
