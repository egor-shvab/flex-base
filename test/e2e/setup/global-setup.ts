import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request, type FullConfig } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { assertDisposableDatabase } from '~~/test/disposable-database'

export const E2E_USER = { email: 'e2e@example.com', password: 'correct-horse-battery' }

const STORAGE_STATE = fileURLToPath(new URL('../.auth/user.json', import.meta.url))

export default async function globalSetup(config: FullConfig) {
  const databaseUrl = assertDisposableDatabase(process.env.DATABASE_URL)

  // Reached only when Playwright was invoked directly; a raw P1001 would read as a broken suite
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    })
  } catch {
    throw new Error(
      'Could not migrate the end-to-end database. Is PostgreSQL running? ' +
        'Start it with `npm run db:up`, or use `npm run test:e2e`, which does it for you.',
    )
  }

  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) throw new Error('No baseURL is configured for the e2e project')

  await prisma.$executeRawUnsafe('TRUNCATE "User", "Table", "Field", "Record" CASCADE')
  await prisma.$disconnect()

  const context = await request.newContext({ baseURL })
  const registered = await context.post('/api/auth/register', { data: E2E_USER })

  if (!registered.ok()) {
    throw new Error(`Could not register the e2e user: ${registered.status()}`)
  }

  mkdirSync(dirname(STORAGE_STATE), { recursive: true })
  writeFileSync(STORAGE_STATE, JSON.stringify(await context.storageState()))

  await context.dispose()
}
