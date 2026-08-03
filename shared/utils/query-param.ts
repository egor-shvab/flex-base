/**
 * A query param arrives as `string | string[] | number | undefined` — only a single non-empty
 * value counts, so a repeat, an empty param and an absent one all read the same. Shared by the
 * list codec and the detail codec, so one URL is never read two ways.
 */
export function singleParam(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw === 'number') return String(raw)
  return typeof raw === 'string' && raw !== '' ? raw : undefined
}
