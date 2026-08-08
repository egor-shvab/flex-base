import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { buildRecordLabelOrderBy, buildRecordLabelSearch } from '#server/services/record-query'
import { prisma } from '#server/utils/prisma'
import { RELATION_OPTIONS_LIMIT } from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import type { IRecord, IRecordOption, TRecordData } from '#shared/types/record'
import { buildRecordLabel } from '#shared/utils/record-label'

/**
 * A relation stores a target record's id, which no schema can validate and no cell can
 * display on its own. This module is where the server resolves both — the one place that
 * knows what a RELATION field means, so `records.ts` stays generic.
 */
export interface IRelationTarget {
  field: IField
  targetTableId: string
  /** The ids this field actually references in the rows at hand — never the whole table. */
  ids: Set<string>
}

/** Just enough of a target record to label it — its number is the fallback when it is blank. */
interface ITargetRow {
  id: string
  number: number
  data: unknown
}

/** Prisma's JSON column is untyped; every row was written through the record schema. */
function toLabelSource(row: ITargetRow): Pick<IRecord, 'number' | 'data'> {
  return { number: row.number, data: (row.data as TRecordData | null) ?? {} }
}

export function collectRelationTargets(fields: IField[], rows: TRecordData[]): IRelationTarget[] {
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
 * The label of every linked record on a page of results, keyed by relation field and then by
 * target record id. An id that no longer resolves is simply absent, so a deleted target
 * degrades to a placeholder in the cell rather than breaking the list.
 */
export async function resolveRelationLabels(
  fields: IField[],
  records: IRecord[],
): Promise<Record<string, Record<string, string>>> {
  const targets = collectRelationTargets(
    fields,
    records.map((record) => record.data),
  )
  if (targets.length === 0) return {}

  const recordsByTable = await fetchTargetRecords(targets)
  const labels: Record<string, Record<string, string>> = {}

  for (const { field, targetTableId, ids } of targets) {
    const found = recordsByTable.get(targetTableId)
    const fieldLabels: Record<string, string> = {}

    for (const id of ids) {
      const target = found?.get(id)
      if (target) fieldLabels[id] = buildRecordLabel(target, field.options?.labelFieldKey)
    }

    labels[field.id] = fieldLabels
  }

  return labels
}

/**
 * Referential integrity for a write: the picker only ever offers live records of the target
 * table, so anything else is a crafted payload and is rejected rather than stored dangling.
 */
export async function assertRelationTargets(fields: IField[], data: TRecordData): Promise<void> {
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
export async function listRelationOptions(field: IField, search = ''): Promise<IRecordOption[]> {
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

  return rows.map((row) => ({
    id: row.id,
    label: buildRecordLabel(toLabelSource(row), labelFieldKey),
  }))
}
