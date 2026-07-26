import type { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/utils/prisma'
import { toHttpError } from '#server/utils/prisma-errors'
import type { IRecord, IRecordPage, TRecordData } from '#shared/types/record'
import type { TRecordQuery } from '#shared/validation/record'

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

/** Always paginated — a table's record set grows with user data and is never returned whole. */
export async function listRecords(tableId: string, query: TRecordQuery): Promise<IRecordPage> {
  const { page, pageSize } = query

  const [records, total] = await prisma.$transaction([
    prisma.record.findMany({
      where: { tableId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: recordSelect,
    }),
    prisma.record.count({ where: { tableId } }),
  ])

  return { records: records.map(toRecordDto), total, page, pageSize }
}

export async function createRecord(tableId: string, data: TRecordData): Promise<IRecord> {
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
  recordId: string,
  data: TRecordData,
): Promise<IRecord> {
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
