import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { buildRecordLabelOrderBy, buildRecordLabelSearch } from '#server/db/record-sql'
import { RELATION_OPTIONS_LIMIT } from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import type { ILinkedRecord, IRecord, IRecordOption, TRecordData } from '#shared/types/record'
import { parseAddressNumber } from '#shared/utils/address'
import { isListFilterValue } from '#shared/utils/filter'
import { buildRecordLabel } from '#shared/utils/record-label'

/**
 * A relation stores a target record's id — which no schema can validate, no cell can display,
 * and no URL should carry. This module resolves all three: it validates a written id, reads a
 * stored one into a label, and turns the address a filter carries back into the id the column
 * holds. The one place that knows what a RELATION field means, so `records.ts` stays generic.
 */
export interface IRelationTarget {
  field: IField
  targetTableId: string
  /** The ids this field actually references in the rows at hand — never the whole table. */
  ids: Set<string>
}

/** Just enough of a target record to say how it reads — its number, and its label field. */
interface ITargetRow {
  id: string
  number: number
  data: unknown
}

/** Prisma's JSON column is untyped; every row was written through the record schema. */
function toLabelSource(row: ITargetRow): Pick<IRecord, 'number' | 'data'> {
  return { number: row.number, data: (row.data as TRecordData | null) ?? {} }
}

/** The one mapping from a stored row to how it reads — both producers below go through it. */
function toLinkedRecord(
  source: Pick<IRecord, 'number' | 'data'>,
  labelFieldKey?: string,
): ILinkedRecord {
  return { number: source.number, label: buildRecordLabel(source, labelFieldKey) }
}

function collectRelationTargets(fields: IField[], rows: TRecordData[]): IRelationTarget[] {
  const targets: IRelationTarget[] = []

  for (const field of fields) {
    const targetTableId = field.type === 'RELATION' ? field.options?.targetTableId : undefined
    if (targetTableId === undefined) continue

    const ids = new Set<string>()
    for (const data of rows) {
      // A multi-value relation stores a list of ids; every consumer below already works in
      // sets and batches, so normalising here is the whole of what several links cost this
      // module. A bare string is also what a row written before the field was widened holds.
      const stored = data[field.key]
      for (const id of Array.isArray(stored) ? stored : [stored]) {
        if (typeof id === 'string' && id !== '') ids.add(id)
      }
    }

    if (ids.size > 0) targets.push({ field, targetTableId, ids })
  }

  return targets
}

/**
 * Every referenced record, in one query per distinct target table — never one per row.
 * Kept grouped by table so a foreign id cannot pass as found through another table's row.
 */
async function fetchTargetRecords(
  targets: IRelationTarget[],
): Promise<Map<string, Map<string, Pick<IRecord, 'number' | 'data'>>>> {
  const idsByTable = new Map<string, Set<string>>()

  for (const { targetTableId, ids } of targets) {
    const merged = idsByTable.get(targetTableId) ?? new Set<string>()
    for (const id of ids) merged.add(id)
    idsByTable.set(targetTableId, merged)
  }

  const lookups = await Promise.all(
    [...idsByTable].map(async ([tableId, ids]): Promise<[string, ITargetRow[]]> => [
      tableId,
      await prisma.record.findMany({
        where: { tableId, id: { in: [...ids] } },
        select: { id: true, number: true, data: true },
      }),
    ]),
  )

  return new Map(
    lookups.map(([tableId, rows]) => [
      tableId,
      new Map(rows.map((row) => [row.id, toLabelSource(row)])),
    ]),
  )
}

/**
 * How every linked record on a page of results reads, keyed by relation field and then by
 * target record id. An id that no longer resolves is simply absent, so a deleted target
 * degrades to a placeholder in the cell rather than breaking the list.
 */
async function resolveLinkedRecords(
  fields: IField[],
  records: IRecord[],
): Promise<Record<string, Record<string, ILinkedRecord>>> {
  const targets = collectRelationTargets(
    fields,
    records.map((record) => record.data),
  )
  if (targets.length === 0) return {}

  const recordsByTable = await fetchTargetRecords(targets)
  const byField: Record<string, Record<string, ILinkedRecord>> = {}

  for (const { field, targetTableId, ids } of targets) {
    const found = recordsByTable.get(targetTableId)
    const byRecordId: Record<string, ILinkedRecord> = {}

    for (const id of ids) {
      const target = found?.get(id)
      if (target) byRecordId[id] = toLinkedRecord(target, field.options?.labelFieldKey)
    }

    byField[field.id] = byRecordId
  }

  return byField
}

/**
 * A relation filter carries the target's **address** — the number a URL shows, or the cuid an
 * older link holds — while the column it compares against stores cuids. This is where the two
 * meet, above `buildRecordWhere` and below the codec: the URL codec is pure, synchronous and
 * shared by both sides of the wire, so it cannot do I/O, and teaching the SQL to compare through
 * a subquery on `"Record"."number"` would defeat RELATION's `filterIndex` — the planner can no
 * longer probe an indexed expression with a constant.
 *
 * **Every requested value survives, resolved or not**, and that is the whole safety property.
 * Dropping one that resolves to nothing would leave a list filter empty, `containsAny` would
 * answer `null`, `buildRecordWhere` would skip the condition, and the list would **silently
 * widen to the entire table** — no error, no empty state, just the wrong rows. Passing it
 * through unchanged cannot do that: a stray number simply matches nothing, because
 * `assertRelationTargets` guarantees every stored relation value is a live record's cuid.
 *
 * One query per distinct target table, never one per value.
 */
async function resolveFilterTargets(
  fields: IField[],
  filters: TRecordFilterValues,
): Promise<TRecordFilterValues> {
  const numbersByTable = new Map<string, Set<number>>()
  const relations: { field: IField; targetTableId: string }[] = []

  for (const field of fields) {
    const targetTableId = field.type === 'RELATION' ? field.options?.targetTableId : undefined
    const value = filters[field.key]
    if (targetTableId === undefined || value === undefined) continue

    relations.push({ field, targetTableId })

    const numbers = numbersByTable.get(targetTableId) ?? new Set<number>()
    for (const entry of Array.isArray(value) ? value : [value]) {
      // `0` is every non-numeric address — a cuid, or anything that is not a row's number
      const number = typeof entry === 'string' ? parseAddressNumber(entry) : 0
      if (number !== 0) numbers.add(number)
    }
    numbersByTable.set(targetTableId, numbers)
  }

  if (relations.length === 0) return filters

  const lookups = await Promise.all(
    [...numbersByTable]
      .filter(([, numbers]) => numbers.size > 0)
      .map(async ([tableId, numbers]): Promise<[string, Map<number, string>]> => {
        const rows = await prisma.record.findMany({
          where: { tableId, number: { in: [...numbers] } },
          select: { id: true, number: true },
        })

        return [tableId, new Map(rows.map((row) => [row.number, row.id]))]
      }),
  )

  const idsByTable = new Map(lookups)
  /** Resolved to its id where possible; otherwise the address exactly as it arrived. */
  const toStoredValue = (targetTableId: string, entry: string) =>
    idsByTable.get(targetTableId)?.get(parseAddressNumber(entry)) ?? entry

  const resolved: TRecordFilterValues = { ...filters }

  for (const { field, targetTableId } of relations) {
    const value = filters[field.key]
    if (value === undefined) continue

    if (isListFilterValue(value)) {
      resolved[field.key] = value.map((entry) => toStoredValue(targetTableId, entry))
    } else if (typeof value === 'string') {
      resolved[field.key] = toStoredValue(targetTableId, value)
    }
  }

  return resolved
}

/**
 * Referential integrity for a write: the picker only ever offers live records of the target
 * table, so anything else is a crafted payload and is rejected rather than stored dangling.
 */
async function assertRelationTargets(fields: IField[], data: TRecordData): Promise<void> {
  const targets = collectRelationTargets(fields, [data])
  if (targets.length === 0) return

  const recordsByTable = await fetchTargetRecords(targets)

  for (const { field, targetTableId, ids } of targets) {
    const found = recordsByTable.get(targetTableId)

    for (const id of ids) {
      if (!found?.has(id)) {
        throw createError({
          statusCode: 400,
          statusMessage: `${field.name}: the linked record no longer exists`,
        })
      }
    }
  }
}

/**
 * The candidates a relation picker offers, label-ascending, optionally narrowed by a term the
 * user typed. Bounded like every other list — a dropdown is not a place to render a whole
 * table — so the cap applies to the *matches*, which is what search is for: a target past the
 * first `RELATION_OPTIONS_LIMIT` is reached by naming it rather than by scrolling to it.
 *
 * The ORDER BY is deliberately untouched by the search: narrowing and ordering are separate
 * questions, and folding the term into the sort would silently reorder every existing picker.
 */
async function listRelationOptions(field: IField, search = ''): Promise<IRecordOption[]> {
  const targetTableId = field.options?.targetTableId
  if (targetTableId === undefined) return []

  const labelFieldKey = field.options?.labelFieldKey
  const searchGroup = buildRecordLabelSearch(labelFieldKey, search)

  const rows = await prisma.$queryRaw<ITargetRow[]>`
    SELECT id, "number", data FROM "Record"
    WHERE "tableId" = ${targetTableId}
    ${searchGroup ? Prisma.sql`AND ${searchGroup}` : Prisma.empty}
    ORDER BY ${buildRecordLabelOrderBy(labelFieldKey)}
    LIMIT ${RELATION_OPTIONS_LIMIT}
  `

  return rows.map((row) => ({ id: row.id, ...toLinkedRecord(toLabelSource(row), labelFieldKey) }))
}

export const RelationService = {
  collectRelationTargets,
  resolveLinkedRecords,
  assertRelationTargets,
  resolveFilterTargets,
  listRelationOptions,
}
