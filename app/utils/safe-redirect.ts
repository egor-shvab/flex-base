/** Restricts a ?redirect query value to internal app paths, preventing open redirects. */
export function resolveSafeRedirect(value: unknown): string {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return '/'
}
