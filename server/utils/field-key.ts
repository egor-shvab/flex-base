import { RESERVED_FIELD_KEYS, RESERVED_QUERY_PARAMS } from '#shared/constants/filter'
import type { IField, TFieldType } from '#shared/types/field'
import { filterParamNames } from '#shared/utils/filter'

/**
 * How a field's immutable machine key is derived from its display name.
 *
 * Server-only rather than shared: nothing in the Vue layer derives a key — the form posts a
 * name and reads back whatever key the server assigned. It lives beside `ownership.ts` rather
 * than inside `services/fields.ts` so the rule can be stated, and tested, on its own.
 */

/**
 * Machine key from a display name: lowercase, non-alphanumerics → `_`.
 *
 * **Emits only `^[a-z0-9_]+$`, and that is load-bearing.** A key becomes a JSONB path bound
 * into raw SQL, and a query param name; `shared/constants/filter.ts` rests its reserved-key
 * argument on the fact that this can never emit the camelCase record columns.
 *
 * A name with no ASCII alphanumerics at all — written in Cyrillic, CJK, or punctuation —
 * reduces to nothing and takes the `field` fallback, so several of them on one table become
 * `field`, `field_2`, `field_3`. Deliberate: see `docs/decisions.md` → Accepted limitations.
 */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field'
  )
}

/**
 * A key must be free for every query param it would claim, not just for itself: filters
 * are named after the field (`price`, `price_from`, `price_to`), so a key may collide
 * with a reserved param or with another field's range bound.
 */
function uniqueKey(base: string, type: TFieldType, taken: Set<string>): string {
  const isFree = (key: string) =>
    !taken.has(key) && filterParamNames(key, type).every((name) => !taken.has(name))

  if (isFree(base)) return base
  let suffix = 2
  while (!isFree(`${base}_${suffix}`)) suffix++
  return `${base}_${suffix}`
}

/**
 * The key a new field takes, given the fields its table already has. Every name the existing
 * fields claim is reserved — their own keys **and** the range bounds their filters spread to —
 * alongside the params the records URL owns and the record's own columns.
 */
export function buildFieldKey(
  name: string,
  type: TFieldType,
  existing: Pick<IField, 'key' | 'type'>[],
): string {
  const taken = new Set<string>([
    ...RESERVED_QUERY_PARAMS,
    ...RESERVED_FIELD_KEYS,
    ...existing.flatMap((field) => [field.key, ...filterParamNames(field.key, field.type)]),
  ])

  return uniqueKey(slugify(name), type, taken)
}
