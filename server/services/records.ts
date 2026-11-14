import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { RECORD_COUNT_CAP } from '#shared/constants/record'
import { buildStaleWriteError, toHttpError } from '#server/utils/http-errors'
import { isMissingRow } from '#server/db/prisma-errors'
import {
  recordSelect,
  recordWithAuthorsSelect,
  buildRecordAddressWhere,
  toJsonData,
  toRecordWithAuthors,
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
function listPageRows(where: Prisma.Sql, order: IRecordOrder, query: IRecordQuery) {
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

function countMatchingRecords(where: Prisma.Sql) {
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
  const resolvedFilters = await RelationService.resolveFilterTargets(fields, filters)
  const where = buildRecordWhere(tableId, fields, resolvedFilters, search)
  const order = buildRecordOrderBy(fields, sort)

  const [rows, counts] = await prisma.$transaction([
    listPageRows(where, order, query),
    countMatchingRecords(where),
  ])

  const records = rows.map(toSharedRecord)
  const counted = counts[0]?.count ?? 0

  return {
    records,
    total: Math.min(counted, RECORD_COUNT_CAP),
    totalCapped: counted > RECORD_COUNT_CAP,
    page,
    pageSize,
    linkedRecords: await RelationService.resolveLinkedRecords(fields, [
      ...records.map((record) => record.data),
      resolvedFilters,
    ]),
  }
}

async function getRecordDetail(
  table: Pick<ITable, 'id' | 'number' | 'name'>,
  fields: IField[],
  address: string,
): Promise<IRecordDetail> {
  const row = await prisma.record.findUnique({
    where: buildRecordAddressWhere(table.id, address),
    select: recordWithAuthorsSelect,
  })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: recordErrors.notFound })
  }

  const record = toRecordWithAuthors(row)

  return {
    table,
    fields,
    record,
    linkedRecords: await RelationService.resolveLinkedRecords(fields, [record.data]),
  }
}

async function createRecord(
  tableId: string,
  fields: IField[],
  data: TRecordData,
  actorId: string,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data)

  try {
    const record = await prisma.$transaction(async (tx) => {
      const { recordCounter } = await tx.table.update({
        where: { id: tableId },
        data: { recordCounter: { increment: 1 }, recordCount: { increment: 1 } },
        select: { recordCounter: true },
      })

      return tx.record.create({
        data: {
          tableId,
          number: recordCounter,
          data: toJsonData(data),
          createdById: actorId,
          updatedById: actorId,
        },
        select: recordSelect,
      })
    })

    return toSharedRecord(record)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

/**
 * Given the version the caller read, the write lands only on that version: the check is in the
 * `where`, so two saves racing cannot both pass it. A miss is told apart afterwards — the row still
 * there is a 412, a row gone is the usual 404.
 */
async function updateRecord(
  tableId: string,
  fields: IField[],
  address: string,
  data: TRecordData,
  actorId: string,
  expectedUpdatedAt?: Date,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data)

  const where = buildRecordAddressWhere(tableId, address)

  try {
    const record = await prisma.record.update({
      where: expectedUpdatedAt ? { ...where, updatedAt: expectedUpdatedAt } : where,
      data: { data: toJsonData(data), updatedById: actorId },
      select: recordSelect,
    })
    return toSharedRecord(record)
  } catch (error) {
    if (expectedUpdatedAt && isMissingRow(error)) {
      const current = await prisma.record.findUnique({ where, select: { id: true } })
      if (current) throw buildStaleWriteError('record')
    }
    throw toHttpError(error, recordErrors)
  }
}

/** The count moves only after the delete found its row: a missing one throws before it. */
async function deleteRecord(tableId: string, address: string) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.record.delete({ where: buildRecordAddressWhere(tableId, address) })
      await tx.table.update({
        where: { id: tableId },
        data: { recordCount: { decrement: 1 } },
        select: { id: true },
      })
    })
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
