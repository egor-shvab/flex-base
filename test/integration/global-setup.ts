import { execSync } from 'node:child_process'
import { assertDisposableDatabase } from '~~/test/disposable-database'

export default function setup() {
  const url = assertDisposableDatabase(process.env.DATABASE_URL)

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
