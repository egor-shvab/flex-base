import { createError } from 'h3'
import { prisma } from '#server/db/prisma'
import { toHttpError } from '#server/utils/http-errors'
import { recordSelect, toJsonData, toSharedRecord, type TRecordRow } from '#server/db/records'
import { buildRecordOrderBy, buildRecordWhere } from '#server/db/record-sql'
import { assertRelationTargets, resolveLinkedRecords } from '#server/services/relations'
import type { IField } from '#shared/types/field'
import type {
  IRecord,
  IRecordDetail,
  IRecordPage,
  IRecordQuery,
  TRecordData,
} from '#shared/types/record'
import type { ITable } from '#shared/types/table'

const recordErrors = { notFound: 'Record not found' }

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
  const { page, pageSize, sort, filters, search } = query
  const where = buildRecordWhere(tableId, fields, filters, search)
  const orderBy = buildRecordOrderBy(fields, sort)

  const [rows, counts] = await prisma.$transaction([
    prisma.$queryRaw<TRecordRow[]>`
      SELECT id, "number", data, "createdAt", "updatedAt" FROM "Record"
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `,
    // COUNT(*) is a bigint, which would arrive as a string without the cast
    prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Record" ${where}`,
  ])

  const records = rows.map(toSharedRecord)

  return {
    records,
    total: counts[0]?.count ?? 0,
    page,
    pageSize,
    // Resolved for the ids on this page alone, in one query per target table
    linkedRecords: await resolveLinkedRecords(fields, records),
  }
}

/**
 * One record with everything needed to render it away from its own table: the relation that
 * points at it knows only an id, so the table and its fields travel with the row. The labels
 * come from the same resolver the list uses, which is what lets a relation inside the dialog
 * read as a label and link on again.
 */
export async function getRecordDetail(
  table: Pick<ITable, 'id' | 'name'>,
  fields: IField[],
  recordId: string,
): Promise<IRecordDetail> {
  const row = await prisma.record.findUnique({
    where: { id: recordId, tableId: table.id },
    select: recordSelect,
  })

  // A record of another user's table is already unreachable — the table was scoped by owner —
  // so this is the ordinary "deleted since the link was rendered" case
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: recordErrors.notFound })
  }

  const record = toSharedRecord(row)

  return {
    table,
    fields,
    record,
    linkedRecords: await resolveLinkedRecords(fields, [record]),
  }
}

/**
 * The record's number is allocated from its table's counter in the same transaction as the
 * insert: the atomic increment takes the row lock, so two concurrent creates queue rather
 * than racing for the same number, and no retry loop is needed. Because the counter is a
 * high-water mark rather than a count, deleting a record never frees its number for reuse.
 */
export async function createRecord(
  tableId: string,
  fields: IField[],
  data: TRecordData,
): Promise<IRecord> {
  await assertRelationTargets(fields, data)

  try {
    const record = await prisma.$transaction(async (tx) => {
      const { recordCounter } = await tx.table.update({
        where: { id: tableId },
        data: { recordCounter: { increment: 1 } },
        select: { recordCounter: true },
      })

      return tx.record.create({
        data: { tableId, number: recordCounter, data: toJsonData(data) },
        select: recordSelect,
      })
    })

    return toSharedRecord(record)
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
    return toSharedRecord(record)
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
