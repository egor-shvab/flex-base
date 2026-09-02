import { execSync } from 'node:child_process'
import { assertDisposableDatabase } from '~~/test/disposable-database'

/**
 * Brings the schema up to date once per run, rather than per file — after refusing to touch
 * a database that is not disposable (`test/disposable-database.ts`, shared with the E2E suite).
 */
export default function setup() {
  const url = assertDisposableDatabase(process.env.DATABASE_URL)

  // `npm run test:integration` brings the container up first, so reaching the catch means
  // Vitest was invoked directly — name the cause rather than surfacing a raw Prisma P1001.
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    })
  } catch {
    throw new Error(
      'Could not migrate the integration database. Is PostgreSQL running? ' +
        'Start it with `npm run db:up`, or use `npm run test:integration`, which does it for you.',
    )
  }
}
