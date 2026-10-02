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

export interface IRelationTarget {
  field: IField
  targetTableId: string
  ids: Set<string>
}

interface ITargetRow {
  id: string
  number: number
  data: unknown
}

function toLabelSource(row: ITargetRow): Pick<IRecord, 'number' | 'data'> {
  return { number: row.number, data: (row.data as TRecordData | null) ?? {} }
}

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
      const stored = data[field.key]
      for (const id of Array.isArray(stored) ? stored : [stored]) {
        if (typeof id === 'string' && id !== '') ids.add(id)
      }
    }

    if (ids.size > 0) targets.push({ field, targetTableId, ids })
  }

  return targets
}

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
