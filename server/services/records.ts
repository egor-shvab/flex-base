import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { RECORD_COUNT_CAP } from '#shared/constants/record'
import { toHttpError } from '#server/utils/http-errors'
import {
  recordSelect,
  recordWhere,
  toJsonData,
  toSharedRecord,
  type TRecordRow,
} from '#server/db/records'
import { buildRecordOrderBy, buildRecordWhere, type IRecordOrder } from '#server/db/record-sql'
import { RelationService } from '#server/services/relations'
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
 * No `WITH … AS MATERIALIZED`: it builds every matching row before the `LIMIT` can discard any,
 * which measured three orders of magnitude slower for a common term.
 */
function selectPage(where: Prisma.Sql, order: IRecordOrder, query: IRecordQuery) {
  const { page, pageSize } = query
  const offset = (page - 1) * pageSize
  const columns = Prisma.sql`id, "number", data, "createdAt", "updatedAt"`

  return prisma.$queryRaw<TRecordRow[]>`
    SELECT ${columns} FROM "Record"
    ${order.join}
    ${where}
    ORDER BY ${order.orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `
}

function selectCount(where: Prisma.Sql) {
  // COUNT(*) is a bigint, which would arrive as a string without the cast
  return prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM (SELECT 1 FROM "Record" ${where} LIMIT ${RECORD_COUNT_CAP + 1}) AS capped
  `
}

async function listRecords(
  tableId: string,
  fields: IField[],
  query: IRecordQuery,
): Promise<IRecordPage> {
  const { page, pageSize, sort, filters, search } = query
  const where = buildRecordWhere(
    tableId,
    fields,
    await RelationService.resolveFilterTargets(fields, filters),
    search,
  )
  const order = buildRecordOrderBy(fields, sort)

  const [rows, counts] = await prisma.$transaction([
    selectPage(where, order, query),
    selectCount(where),
  ])

  const records = rows.map(toSharedRecord)
  const counted = counts[0]?.count ?? 0

  return {
    records,
    total: Math.min(counted, RECORD_COUNT_CAP),
    totalCapped: counted > RECORD_COUNT_CAP,
    page,
    pageSize,
    linkedRecords: await RelationService.resolveLinkedRecords(fields, records),
  }
}

async function getRecordDetail(
  table: Pick<ITable, 'id' | 'number' | 'name'>,
  fields: IField[],
  address: string,
): Promise<IRecordDetail> {
  const row = await prisma.record.findUnique({
    where: recordWhere(table.id, address),
    select: recordSelect,
  })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: recordErrors.notFound })
  }

  const record = toSharedRecord(row)

  return {
    table,
    fields,
    record,
    linkedRecords: await RelationService.resolveLinkedRecords(fields, [record]),
  }
}

async function createRecord(
  tableId: string,
  fields: IField[],
  data: TRecordData,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data)

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

async function updateRecord(
  tableId: string,
  fields: IField[],
  address: string,
  data: TRecordData,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data)

  try {
    const record = await prisma.record.update({
      where: recordWhere(tableId, address),
      data: { data: toJsonData(data) },
      select: recordSelect,
    })
    return toSharedRecord(record)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

async function deleteRecord(tableId: string, address: string) {
  try {
    await prisma.record.delete({ where: recordWhere(tableId, address) })
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

export const RecordService = {
  listRecords,
  getRecordDetail,
  createRecord,
  updateRecord,
  deleteRecord,
}
