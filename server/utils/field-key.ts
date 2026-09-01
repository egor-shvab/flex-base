import { RESERVED_FIELD_KEYS, RESERVED_QUERY_PARAMS } from '#shared/constants/filter'
import type { IField, TFieldType } from '#shared/types/field'
import { filterParamNames } from '#shared/utils/filter'

/**
 * How a field's immutable machine key is derived from its display name. Server-only: nothing in
 * the Vue layer derives a key — the form posts a name and reads back what the server assigned.
 */

/**
 * Machine key from a display name: lowercase, non-alphanumerics → `_`.
 *
 * **Emits only `^[a-z0-9_]+$`, and that is load-bearing.** A key becomes a JSONB path bound into
 * raw SQL and a query param name, and `shared/constants/filter.ts` rests its reserved-key
 * argument on this never emitting the camelCase record columns.
 *
 * A name with no ASCII alphanumerics reduces to nothing and takes the `field` fallback, so
 * several on one table become `field`, `field_2`, `field_3` (`docs/limitations.md`).
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
 * A key must be free for every query param it would claim, not just itself: filters are named
 * after the field (`price`, `price_from`, `price_to`), so one may collide with a reserved param
 * or another field's range bound.
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
 * The key a new field takes, given the fields its table has. Every name they claim is reserved —
 * their keys **and** the range bounds their filters spread to — alongside the params the records
 * URL owns and the record's own columns.
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
