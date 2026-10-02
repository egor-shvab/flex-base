import { sqlFor } from '#server/db/field-types/registry'
import { fieldSelect, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import type { TFieldIndexKind } from '#server/db/field-types/types'
import type { IField } from '#shared/types/field'

/**
 * One sort index per direction is required: the ordering is `NULLS LAST` both ways, and an
 * `ASC NULLS LAST` B-tree scanned backwards is `DESC NULLS FIRST`, which PostgreSQL will not use.
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
  expression: string
  descending: boolean
}

export interface IReconcileReport {
  created: string[]
  dropped: string[]
  reaped: string[]
}

/**
 * Named from `Field.id`, never its key: PostgreSQL silently truncates identifiers past 63 bytes,
 * so two long keys could collide into one index.
 */
function indexName(fieldId: string, purpose: TIndexPurpose): string {
  return `rec_idx_${fieldId}_${PURPOSE_SUFFIX[purpose]}`
}

const INDEX_PREFIX = 'rec_idx_'

/** DDL takes no parameters, so this is the one place a key reaches SQL unbound. */
function assertSafeKey(key: string): void {
  if (!/^[a-z0-9_]+$/.test(key)) {
    throw new Error(`Unsafe field key for DDL: ${JSON.stringify(key)}`)
  }
}

/**
 * Not byte-identical to the query, which binds the key: PostgreSQL still matches them because an
 * unnamed prepared statement is planned at Bind. If the two drift the index is silently unused —
 * the per-kind plan assertions catch that.
 */
function indexExpression(field: IField, purpose: TIndexPurpose): string {
  assertSafeKey(field.key)

  const rules = sqlFor(field)
  const literalKey = `'${field.key}'`

  if (purpose !== 'filter' && rules.sortExpr) {
    return `data -> ${literalKey} ->> 0`
  }

  const projected = rules.expr(field.key).text
  return projected.replace(/\$\d+::text/g, `${literalKey}::text`)
}

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
 * `CONCURRENTLY`, so never inside a transaction. A B-tree trails with `"createdAt"`, the tie-break
 * every ordering carries; a GIN cannot compose, and is bitmap-ANDed with the `tableId` index.
 */
function createStatement(index: IFieldIndex): string {
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
 * Invalid indexes are dropped first: `IF NOT EXISTS` would otherwise see a failed build as present
 * and never rebuild it.
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

export async function dropFieldIndexes(fieldId: string): Promise<void> {
  for (const { name } of await ownedIndexes()) {
    if (name.startsWith(`${INDEX_PREFIX}${fieldId}_`)) {
      await prisma.$executeRawUnsafe(dropStatement(name))
    }
  }
}

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
    ;(valid ? dropped : reaped).push(name)
  }

  const present = new Set((await ownedIndexes()).map((index) => index.name))
  const created: string[] = []

  for (const index of wanted.values()) {
    if (present.has(index.name)) continue

    await prisma.$executeRawUnsafe(createStatement(index))
    created.push(index.name)
  }

  return { created, dropped, reaped }
}

export interface IFieldIndexStat {
  name: string
  fieldId: string
  valid: boolean
  scans: number
  bytes: number
}

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
    fieldId: row.name.slice(INDEX_PREFIX.length, row.name.lastIndexOf('_')),
    valid: row.valid,
    scans: Number(row.scans),
    bytes: Number(row.bytes),
  }))
}
