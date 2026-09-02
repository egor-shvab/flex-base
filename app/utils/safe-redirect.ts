/**
 * A path that leaves the app: `//evil.com` is protocol-relative, and browsers normalise the
 * backslash in `/\evil.com` to a slash before resolving it — so both forms have to be refused,
 * not just the one that looks wrong.
 */
const LEAVES_THE_APP = /^\/[/\\]/

/** Restricts a ?redirect query value to internal app paths, preventing open redirects. */
export function resolveSafeRedirect(value: unknown): string {
  if (typeof value === 'string' && value.startsWith('/') && !LEAVES_THE_APP.test(value)) {
    return value
  }
  return '/'
}
