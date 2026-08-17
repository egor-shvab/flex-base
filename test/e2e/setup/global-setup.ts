import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request, type FullConfig } from '@playwright/test'
import { prisma } from '#server/db/prisma'
import { assertDisposableDatabase } from '~~/test/disposable-database'

export const E2E_USER = { email: 'e2e@example.com', password: 'correct-horse-battery' }

const STORAGE_STATE = fileURLToPath(new URL('../.auth/user.json', import.meta.url))

/**
 * Migrates the disposable database, then registers the one account the whole suite runs as and
 * saves its cookie. Registering through the API rather than the UI: the sign-up form has its
 * own spec, and every other file only needs to arrive already signed in.
 */
export default async function globalSetup(config: FullConfig) {
  // Already asserted in `playwright.config.ts`, which set it — re-checked because this is the
  // last point before `migrate deploy` starts writing
  const databaseUrl = assertDisposableDatabase(process.env.DATABASE_URL)

  // `npm run test:e2e` brings the container up first, so reaching this branch means someone
  // invoked Playwright directly. Say so plainly: the raw Prisma P1001 arrives after a full
  // Nuxt build and reads as a broken suite rather than a stopped database.
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

  // Every run starts from nothing, accounts included — otherwise the sign-up case leaves a
  // user behind on each run and the database grows a little every time
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
