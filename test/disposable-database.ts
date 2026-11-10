/**
 * Both suites wipe every table between cases, so a database is disposable only if its name says
 * so. Never widen this to "differs from `DATABASE_URL`": that is what a forgotten override leaves.
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
