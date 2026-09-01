/**
 * The one rule standing between a misconfigured connection string and real work.
 *
 * Both suites wipe every table between cases, against the same container the development
 * database lives on. A database is disposable only if its name says so — `flexbase_test`,
 * `flexbase_e2e` — and anything else is refused before a statement runs.
 *
 * Never widen this to "the URL differs from `DATABASE_URL`": the development URL is exactly what
 * a forgotten override leaves behind.
 */
const DISPOSABLE_SUFFIX = /_(test|e2e)$/

export function assertDisposableDatabase(url: string | undefined): string {
  if (!url) throw new Error('No database URL was supplied to a suite that requires one')

  const name = new URL(url).pathname.replace(/^\//, '')

  if (!DISPOSABLE_SUFFIX.test(name)) {
    throw new Error(
      `Refusing to run against "${name}": this suite truncates every table, and only a ` +
        `database whose name ends in "_test" or "_e2e" is treated as disposable.`,
    )
  }

  return url
}
