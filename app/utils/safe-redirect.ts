/** Browsers normalise `/\evil.com` to `//evil.com`, so both forms are refused. */
const LEAVES_THE_APP = /^\/[/\\]/

export function resolveSafeRedirect(value: unknown): string {
  if (typeof value === 'string' && value.startsWith('/') && !LEAVES_THE_APP.test(value)) {
    return value
  }
  return '/'
}
