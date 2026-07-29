import type { Prisma } from '#server/generated/prisma/client'
import { buildRecordOrderBy, buildRecordWhere } from '#server/services/record-query'
import { assertRelationTargets, resolveRelationLabels } from '#server/services/relations'
import { prisma } from '#server/utils/prisma'
import { toHttpError } from '#server/utils/prisma-errors'
import type { IField } from '#shared/types/field'
import type { IRecord, IRecordPage, IRecordQuery, TRecordData } from '#shared/types/record'

const recordSelect = {
  id: true,
  data: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RecordSelect

type TRecordRow = Prisma.RecordGetPayload<{ select: typeof recordSelect }>

const recordErrors = { notFound: 'Record not found' }

/** Narrows Prisma's untyped JSONB column onto the shared record shape. */
function toRecordDto(record: TRecordRow): IRecord {
  return {
    id: record.id,
    data: (record.data as TRecordData | null) ?? {},
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/** Validated payloads only ever contain declared field keys, so the cast is safe here. */
function toJsonData(data: TRecordData): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject
}

/**
 * Always paginated — a table's record set grows with user data and is never returned whole.
 * Raw SQL because Prisma cannot order by a JSON path; the WHERE fragment is shared with the
 * count so both legs of the transaction see the same rows.
 */
export async function listRecords(
  tableId: string,
  fields: IField[],
  query: IRecordQuery,
): Promise<IRecordPage> {
  const { page, pageSize, sort, filters } = query
  const where = buildRecordWhere(tableId, fields, filters)
  const orderBy = buildRecordOrderBy(fields, sort)

  const [rows, counts] = await prisma.$transaction([
    prisma.$queryRaw<TRecordRow[]>`
      SELECT id, data, "createdAt", "updatedAt" FROM "Record"
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `,
    // COUNT(*) is a bigint, which would arrive as a string without the cast
    prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Record" ${where}`,
  ])

  const records = rows.map(toRecordDto)

  return {
    records,
    total: counts[0]?.count ?? 0,
    page,
    pageSize,
    // Resolved for the ids on this page alone, in one query per target table
    relationLabels: await resolveRelationLabels(fields, records),
  }
}

export async function createRecord(
  tableId: string,
  fields: IField[],
  data: TRecordData,
): Promise<IRecord> {
  await assertRelationTargets(fields, data)

  try {
    const record = await prisma.record.create({
      data: { tableId, data: toJsonData(data) },
      select: recordSelect,
    })
    return toRecordDto(record)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

/** The form always submits every field, so `data` is replaced wholesale rather than merged. */
export async function updateRecord(
  tableId: string,
  fields: IField[],
  recordId: string,
  data: TRecordData,
): Promise<IRecord> {
  await assertRelationTargets(fields, data)

  try {
    const record = await prisma.record.update({
      where: { id: recordId, tableId },
      data: { data: toJsonData(data) },
      select: recordSelect,
    })
    return toRecordDto(record)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

export async function deleteRecord(tableId: string, recordId: string) {
  try {
    await prisma.record.delete({ where: { id: recordId, tableId } })
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}
