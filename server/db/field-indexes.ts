import { sqlFor } from '#server/db/field-types/registry'
import { fieldSelect, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import type { TFieldIndexKind } from '#server/db/field-types/types'
import type { IField } from '#shared/types/field'

/**
 * The indexes a field carries when it is opted in, and the DDL that creates and removes them.
 *
 * **These are expression indexes, which Prisma cannot express** — the same reason the search
 * index lives in a hand-written migration (`architecture.md` §9). Prisma ignores what it cannot
 * represent, so nothing here shows up as schema drift; it also means nothing here is created for
 * you, and this module is the only thing that knows these indexes exist.
 */

/**
 * What one index is for.
 *
 * **Sorting needs one index per direction, and that is not a choice.** `buildRecordOrderBy`
 * emits `NULLS LAST` whichever way the column is sorted, because blanks belong at the bottom
 * either way. A B-tree scanned backwards yields the exact reverse of how it was built, so an
 * `ASC NULLS LAST` index reversed gives `DESC NULLS **FIRST**` — which is not what the query
 * asks for, and PostgreSQL will sort the rows outright rather than use it. Verified: with only
 * the ascending index present, a descending sort ignores it even with `enable_sort` off.
 */
type TIndexPurpose = 'filter' | 'sortAsc' | 'sortDesc'

const PURPOSE_SUFFIX: Record<TIndexPurpose, string> = {
  filter: 'f',
  sortAsc: 'sa',
  sortDesc: 'sd',
}

interface IFieldIndex {
  name: string
  kind: TFieldIndexKind
  /** The indexed expression, with the field key as a **literal** — see `indexExpression`. */
  expression: string
  /** `DESC` for the descending sort index; the rest take the B-tree default. */
  descending: boolean
}

/**
 * What a reconcile did. Returned rather than logged because this is the one operator-facing entry
 * point in the module, and a pass that reports nothing is one nobody can act on.
 *
 * `reaped` is kept apart from `dropped`: both were removed, but a dropped index is one no field
 * wants any more, while a reaped one is a build that **failed** and still needs doing.
 */
export interface IReconcileReport {
  created: string[]
  dropped: string[]
  reaped: string[]
}

/**
 * **Named from `Field.id`, never from its key.** A field *name* may be 100 characters and
 * `slugify` maps it roughly 1:1 into the key, so a key-based name would run past PostgreSQL's
 * 63-byte identifier limit — which it truncates **silently**, letting two long keys on one table
 * collide into a single index. A cuid keeps this at 35 characters, and it makes the reverse
 * lookup (which field owns this index?) a substring match rather than a join.
 */
function indexName(fieldId: string, purpose: TIndexPurpose): string {
  return `rec_idx_${fieldId}_${PURPOSE_SUFFIX[purpose]}`
}

/** Matches every index this module owns, for reaping orphans. */
const INDEX_PREFIX = 'rec_idx_'

/**
 * A field key is interpolated into DDL rather than bound, because **DDL takes no parameters** —
 * `CREATE INDEX … ON ((data ->> $1))` is not a statement PostgreSQL will accept.
 *
 * That is safe only because `slugify` emits `^[a-z0-9_]+$` and nothing else, which is the same
 * guarantee the raw-SQL layer already rests on. Asserted rather than trusted: this is the one
 * place in the project where a key reaches SQL unbound, so the guarantee is checked where it is
 * relied on rather than at the far end of the system that produces it.
 */
function assertSafeKey(key: string): void {
  if (!/^[a-z0-9_]+$/.test(key)) {
    throw new Error(`Unsafe field key for DDL: ${JSON.stringify(key)}`)
  }
}

/**
 * The indexed expression, as text with the key inlined.
 *
 * **It is deliberately not byte-identical to what a query emits.** A query binds the key
 * (`data ->> $2::text`); an index must inline it (`data ->> 'company'::text`). PostgreSQL still
 * matches the two, because an unnamed prepared statement is planned at Bind with the parameter
 * values in hand — proven in this codebase by the multi-value plan assertion, which builds a GIN
 * on the literal `(data->'tags')` and watches a parameterised `?|` use it.
 *
 * What that costs is a guarantee no type can give: the two expressions are generated separately
 * and could drift apart, at which point the index is built and silently never used. The plan
 * assertions per index kind are what catch it.
 */
function indexExpression(field: IField, purpose: TIndexPurpose): string {
  assertSafeKey(field.key)

  const rules = sqlFor(field)
  const literalKey = `'${field.key}'`

  // Rebuilt from the same fragments the query uses, with the key inlined. Kept as one small
  // branch rather than a second registry: the *kinds* are per type, but this rendering is not.
  if (purpose !== 'filter' && rules.sortExpr) {
    // The only indexable `sortExpr` today is a multi-value column's first element
    return `data -> ${literalKey} ->> 0`
  }

  const projected = rules.expr(field.key).text
  // `expr` emits `data ->> $n::text` or a cast around it; swap the placeholder for the literal
  return projected.replace(/\$\d+::text/g, `${literalKey}::text`)
}

/** Which indexes a field should have. Empty when it is not opted in, or when nothing can serve it. */
export function fieldIndexes(field: IField): IFieldIndex[] {
  if (!field.indexed) return []

  const rules = sqlFor(field)
  const wanted: IFieldIndex[] = []

  if (rules.filterIndex) {
    wanted.push({
      name: indexName(field.id, 'filter'),
      kind: rules.filterIndex,
      expression: indexExpression(field, 'filter'),
      descending: false,
    })
  }

  if (rules.sortIndex) {
    const expression = indexExpression(field, 'sortAsc')
    const filter = wanted[0]

    // The ascending index and an ascending B-tree filter index are the same object — a range
    // filter's index already stores the column in `ASC NULLS LAST` order. Only a type whose
    // filter wants a different structure (TEXT wants trigrams) or a different projection (a
    // widened column filters on the array, sorts on its first element) needs a second one.
    const filterCovers =
      filter && filter.kind === rules.sortIndex && filter.expression === expression

    if (!filterCovers) {
      wanted.push({
        name: indexName(field.id, 'sortAsc'),
        kind: rules.sortIndex,
        expression,
        descending: false,
      })
    }

    // Never covered by the above, whatever the filter looks like: see `TIndexPurpose`
    wanted.push({
      name: indexName(field.id, 'sortDesc'),
      kind: rules.sortIndex,
      expression,
      descending: true,
    })
  }

  return wanted
}

/**
 * The `CREATE INDEX` for one index.
 *
 * **`CONCURRENTLY`, and therefore never inside a transaction** — PostgreSQL refuses it there, and
 * the whole point is that building an index must not block writes to a table someone is using.
 * `IF NOT EXISTS` makes a repeated call a no-op, which is what lets the caller fire this without
 * coordinating against another request doing the same.
 *
 * A B-tree leads with `"tableId"` so one index serves the table it belongs to rather than every
 * table at once, and trails with `"createdAt"` to cover the tie-break every ordering carries. A
 * GIN cannot compose that way, so it indexes the expression alone and the planner combines it
 * with the `tableId` index through a bitmap AND.
 */
function createStatement(index: IFieldIndex): string {
  // `NULLS LAST` is spelled out rather than left to the default because it is only the default
  // ascending — and the ordering this has to match asks for it either way
  const direction = index.descending ? ' DESC NULLS LAST' : ' ASC NULLS LAST'

  const target =
    index.kind === 'btree'
      ? `("tableId", (${index.expression})${direction}, "createdAt" DESC)`
      : index.kind === 'trigram'
        ? `USING gin ((${index.expression}) gin_trgm_ops)`
        : `USING gin ((${index.expression}))`

  return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${index.name}" ON "Record" ${target}`
}

function dropStatement(name: string): string {
  return `DROP INDEX CONCURRENTLY IF EXISTS "${name}"`
}

/** Every index on `Record` this module owns, valid or not. */
async function ownedIndexes(): Promise<{ name: string; valid: boolean }[]> {
  const rows = await prisma.$queryRaw<{ name: string; valid: boolean }[]>`
    SELECT c.relname AS name, i.indisvalid AS valid
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    WHERE c.relname LIKE ${`${INDEX_PREFIX}%`}
  `
  return rows
}

/**
 * Brings one field's indexes in line with what it declares: drops what it should not have, and
 * creates what it should.
 *
 * **Invalid indexes are dropped first.** A `CONCURRENTLY` build that fails leaves one behind that
 * costs every write and serves no read, and `IF NOT EXISTS` would otherwise see it as present and
 * skip the rebuild forever — so the failure would be permanent and silent.
 */
export async function syncFieldIndexes(field: IField): Promise<void> {
  const wanted = fieldIndexes(field)
  const wantedByName = new Map(wanted.map((index) => [index.name, index]))
  const owned = await ownedIndexes()

  for (const { name, valid } of owned) {
    const isThisField = name.startsWith(`${INDEX_PREFIX}${field.id}_`)
    if (!isThisField) continue

    if (!wantedByName.has(name) || !valid) {
      await prisma.$executeRawUnsafe(dropStatement(name))
    }
  }

  const present = new Set(owned.filter((index) => index.valid).map((index) => index.name))

  for (const index of wanted) {
    if (!present.has(index.name)) await prisma.$executeRawUnsafe(createStatement(index))
  }
}

/** Drops every index a field owns — for a field being deleted, or opted back out. */
export async function dropFieldIndexes(fieldId: string): Promise<void> {
  for (const { name } of await ownedIndexes()) {
    if (name.startsWith(`${INDEX_PREFIX}${fieldId}_`)) {
      await prisma.$executeRawUnsafe(dropStatement(name))
    }
  }
}

/**
 * The whole-database pass: every opted-in field gets what it declares, and every index whose field
 * no longer wants it — or no longer exists — is dropped.
 *
 * Exported and tested, but **nothing calls it on a schedule**. Field writes keep themselves in
 * step; this exists for drift, for indexes orphaned by a failure, and as the body of the job that
 * runs when there is somewhere to run it (`limitations.md`).
 */
export async function reconcileFieldIndexes(): Promise<IReconcileReport> {
  const rows = await prisma.field.findMany({ select: fieldSelect })
  const wanted = new Map(
    rows
      .map(toSharedField)
      .flatMap((field) =>
        fieldIndexes(field).map((index): [string, IFieldIndex] => [index.name, index]),
      ),
  )

  const dropped: string[] = []
  const reaped: string[] = []

  for (const { name, valid } of await ownedIndexes()) {
    if (wanted.has(name) && valid) continue

    await prisma.$executeRawUnsafe(dropStatement(name))
    // An index nobody wants and one that failed to build are both dropped here, but they mean
    // different things: the first is tidying, the second is a build that needs doing again
    ;(valid ? dropped : reaped).push(name)
  }

  // Re-read rather than reusing the list above: the drops just changed it, and creating over an
  // index that is still present would be a no-op that hides a stale one
  const present = new Set((await ownedIndexes()).map((index) => index.name))
  const created: string[] = []

  for (const index of wanted.values()) {
    if (present.has(index.name)) continue

    await prisma.$executeRawUnsafe(createStatement(index))
    created.push(index.name)
  }

  return { created, dropped, reaped }
}

/**
 * What one owned index has cost and returned.
 *
 * The question this exists to answer is **"was opting this field in worth it?"**, and nothing else
 * in the project can: an index that is never scanned still returns correct results, so it shows up
 * only as writes being slower than they need to be. `scans` at zero on a table with real traffic
 * is the signal to opt the field back out.
 *
 * `valid` catches the other silent case — a `CONCURRENTLY` build that failed leaves an index that
 * costs every write and serves no read, and nothing surfaces that either.
 */
export interface IFieldIndexStat {
  name: string
  /** The field that owns it, recoverable from the name because that is how it was built. */
  fieldId: string
  valid: boolean
  scans: number
  bytes: number
}

/** Every index this module owns, with what PostgreSQL has recorded about it. */
export async function fieldIndexStats(): Promise<IFieldIndexStat[]> {
  const rows = await prisma.$queryRaw<
    { name: string; valid: boolean; scans: bigint | number; bytes: bigint | number }[]
  >`
    SELECT c.relname AS name,
           i.indisvalid AS valid,
           COALESCE(s.idx_scan, 0) AS scans,
           pg_relation_size(c.oid) AS bytes
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = c.oid
    WHERE c.relname LIKE ${`${INDEX_PREFIX}%`}
    ORDER BY c.relname
  `

  return rows.map((row) => ({
    name: row.name,
    // `rec_idx_<fieldId>_<purpose>` — the purpose suffix carries no underscore, so one split off
    // the end recovers the id whatever the cuid contains
    fieldId: row.name.slice(INDEX_PREFIX.length, row.name.lastIndexOf('_')),
    valid: row.valid,
    // `idx_scan` and `pg_relation_size` are bigints, which arrive as `BigInt` rather than a number
    scans: Number(row.scans),
    bytes: Number(row.bytes),
  }))
}
