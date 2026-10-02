import { RESERVED_FIELD_KEYS, RESERVED_QUERY_PARAMS } from '#shared/constants/filter'
import type { IField, TFieldType } from '#shared/types/field'
import { filterParamNames } from '#shared/utils/filter'

/**
 * Emitting only `^[a-z0-9_]+$` is load-bearing: a key is a JSONB path in raw SQL and a query param
 * name, and must never collide with the camelCase record columns.
 */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field'
  )
}

function uniqueKey(base: string, type: TFieldType, taken: Set<string>): string {
  const isFree = (key: string) =>
    !taken.has(key) && filterParamNames(key, type).every((name) => !taken.has(name))

  if (isFree(base)) return base
  let suffix = 2
  while (!isFree(`${base}_${suffix}`)) suffix++
  return `${base}_${suffix}`
}

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
