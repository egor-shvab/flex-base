import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { buildRecordLabelOrderBy, buildRecordLabelSearch } from '#server/db/record-sql'
import type { IRecordActor } from '#server/db/records'
import { RELATION_OPTIONS_LIMIT } from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import type { ILinkedRecord, IRecordOption, TRecordData } from '#shared/types/record'
import { parseAddressNumber } from '#shared/utils/address'
import { isListFilterValue } from '#shared/utils/filter'
import { buildRecordLabel } from '#shared/utils/record-label'

export interface IRelationTarget {
  field: IField
  targetTableId: string
  ids: Set<string>
}

/** A target row with only its label field's value projected — never the whole `data`. */
interface ILabelRow {
  id: string
  number: number
  createdById: string | null
  label: unknown
}

/** Whose records of the target a caller reaches: `undefined` for all of them. */
type TRelationReach = Pick<IRecordActor, 'userId' | 'targetScopes'>

function findTargetAuthorId(reach: TRelationReach, targetTableId: string): string | undefined {
  return reach.targetScopes.get(targetTableId) === 'OWN' ? reach.userId : undefined
}

function labelExpr(labelFieldKey: string | undefined): Prisma.Sql {
  return labelFieldKey === undefined ? Prisma.sql`NULL` : Prisma.sql`data -> ${labelFieldKey}::text`
}

function toLinkedRecord(row: ILabelRow, labelFieldKey?: string): ILinkedRecord {
  const data = (labelFieldKey === undefined ? {} : { [labelFieldKey]: row.label }) as TRecordData
  return {
    number: row.number,
    label: buildRecordLabel({ number: row.number, data }, labelFieldKey),
  }
}

/** The relation-field values in each row; a resolved filter has the same shape as a record. */
function buildRelationTargets(
  fields: IField[],
  rows: readonly Readonly<Record<string, unknown>>[],
): IRelationTarget[] {
  const targets: IRelationTarget[] = []

  for (const field of fields) {
    const targetTableId = field.type === 'RELATION' ? field.options?.targetTableId : undefined
    if (targetTableId === undefined) continue

    const ids = new Set<string>()
    for (const data of rows) {
      const stored = data[field.key]
      for (const id of Array.isArray(stored) ? stored : [stored]) {
        if (typeof id === 'string' && id !== '') ids.add(id)
      }
    }

    if (ids.size > 0) targets.push({ field, targetTableId, ids })
  }

  return targets
}

function toLookupKey(target: IRelationTarget): string {
  return JSON.stringify([target.targetTableId, target.field.options?.labelFieldKey ?? null])
}

/**
 * One query per target table and label field, however many fields and rows share them, each
 * projecting that one value.
 */
async function listTargetRecords(
  targets: IRelationTarget[],
): Promise<Map<string, Map<string, ILabelRow>>> {
  const groups = new Map<string, { tableId: string; labelFieldKey?: string; ids: Set<string> }>()

  for (const target of targets) {
    const key = toLookupKey(target)
    const group = groups.get(key) ?? {
      tableId: target.targetTableId,
      labelFieldKey: target.field.options?.labelFieldKey,
      ids: new Set<string>(),
    }
    for (const id of target.ids) group.ids.add(id)
    groups.set(key, group)
  }

  const lookups = await Promise.all(
    [...groups].map(
      async ([key, { tableId, labelFieldKey, ids }]): Promise<[string, ILabelRow[]]> => [
        key,
        await prisma.$queryRaw<ILabelRow[]>`
        SELECT id, "number", "createdById", ${labelExpr(labelFieldKey)} AS label FROM "Record"
        WHERE "tableId" = ${tableId} AND id IN (${Prisma.join([...ids])})
      `,
      ],
    ),
  )

  return new Map(lookups.map(([key, rows]) => [key, new Map(rows.map((row) => [row.id, row]))]))
}

/**
 * `rows` are records' data, and may include a resolved filter: its chips need the labels of the
 * records it names even when no row on the page links to them.
 */
async function resolveLinkedRecords(
  fields: IField[],
  rows: readonly Readonly<Record<string, unknown>>[],
): Promise<Record<string, Record<string, ILinkedRecord>>> {
  const targets = buildRelationTargets(fields, rows)
  if (targets.length === 0) return {}

  const recordsByLookup = await listTargetRecords(targets)
  const byField: Record<string, Record<string, ILinkedRecord>> = {}

  for (const target of targets) {
    const { field, ids } = target
    const found = recordsByLookup.get(toLookupKey(target))
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
 * Every requested value survives, resolved or not. Dropping an unresolved one would empty a list
 * filter, `buildRecordWhere` would skip the condition, and the list would silently widen to the
 * whole table; a stray number passed through simply matches nothing.
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
 * Refuses with a 409 while a RELATION field points at the table — or, given a key, shows that field
 * of the table as its label, which would silently fall back to record numbers.
 */
async function assertNotRelationTarget(
  workspaceId: string,
  tableId: string,
  labelFieldKey?: string,
): Promise<void> {
  const reference = await prisma.field.findFirst({
    where: {
      type: 'RELATION',
      table: { workspaceId },
      options: { path: ['targetTableId'], equals: tableId },
      ...(labelFieldKey === undefined
        ? {}
        : { AND: [{ options: { path: ['labelFieldKey'], equals: labelFieldKey } }] }),
    },
    select: { name: true, table: { select: { name: true } } },
  })

  if (reference) {
    const reason =
      labelFieldKey === undefined ? 'links to this table' : 'shows this field as its label'
    throw createError({
      statusCode: 409,
      statusMessage: `"${reference.name}" in "${reference.table.name}" ${reason}`,
    })
  }
}

/**
 * Every linked record must exist, and a new link must reach a record the caller reads: under an
 * `OWN` scope on the target, one they created. A link already stored stays, whoever made it, or
 * the caller could not save a record someone else linked onwards. `findStoredData` reads what the
 * record holds now, and is asked only when a link reaches past the caller's sight.
 */
async function assertRelationTargets(
  fields: IField[],
  data: TRecordData,
  reach: TRelationReach,
  findStoredData: () => Promise<TRecordData | null> = async () => null,
): Promise<void> {
  const targets = buildRelationTargets(fields, [data])
  if (targets.length === 0) return

  const recordsByLookup = await listTargetRecords(targets)
  let stored: TRecordData | null | undefined

  for (const target of targets) {
    const { field, ids } = target
    const found = recordsByLookup.get(toLookupKey(target))
    const authorId = findTargetAuthorId(reach, target.targetTableId)

    for (const id of ids) {
      const linked = found?.get(id)
      if (!linked) {
        throw createError({
          statusCode: 400,
          statusMessage: `${field.name}: the linked record no longer exists`,
        })
      }
      if (authorId === undefined || linked.createdById === authorId) continue

      stored ??= await findStoredData()
      const kept = stored?.[field.key]
      if (Array.isArray(kept) ? kept.includes(id) : kept === id) continue

      throw createError({
        statusCode: 400,
        statusMessage: `${field.name}: you can only link to your own records`,
      })
    }
  }
}

async function listRelationOptions(
  field: IField,
  reach: TRelationReach,
  search = '',
): Promise<IRecordOption[]> {
  const targetTableId = field.options?.targetTableId
  if (targetTableId === undefined) return []

  const labelFieldKey = field.options?.labelFieldKey
  const searchGroup = buildRecordLabelSearch(labelFieldKey, search)
  const authorId = findTargetAuthorId(reach, targetTableId)

  const rows = await prisma.$queryRaw<ILabelRow[]>`
    SELECT id, "number", "createdById", ${labelExpr(labelFieldKey)} AS label FROM "Record"
    WHERE "tableId" = ${targetTableId}
    ${authorId === undefined ? Prisma.empty : Prisma.sql`AND "createdById" = ${authorId}`}
    ${searchGroup ? Prisma.sql`AND ${searchGroup}` : Prisma.empty}
    ORDER BY ${buildRecordLabelOrderBy(labelFieldKey)}
    LIMIT ${RELATION_OPTIONS_LIMIT}
  `

  return rows.map((row) => ({ id: row.id, ...toLinkedRecord(row, labelFieldKey) }))
}

export const RelationService = {
  buildRelationTargets,
  resolveLinkedRecords,
  assertRelationTargets,
  assertNotRelationTarget,
  resolveFilterTargets,
  listRelationOptions,
}
