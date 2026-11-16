import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { RECORD_COUNT_CAP } from '#shared/constants/record'
import { buildStaleWriteError, toHttpError } from '#server/utils/http-errors'
import { isMissingRow } from '#server/db/prisma-errors'
import {
  type IRecordActor,
  recordSelect,
  recordWithAuthorsSelect,
  buildRecordAddressWhere,
  buildRecordScopeWhere,
  toJsonData,
  toRecordWithAuthors,
  toSharedRecord,
  type TRecordRow,
} from '#server/db/records'
import {
  buildRecordMergeUpdate,
  buildRecordOrderBy,
  buildRecordWhere,
  type IRecordOrder,
} from '#server/db/record-sql'
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
import { canDeleteRecord, canUpdateRecord } from '#shared/utils/table-access'

const recordErrors = { notFound: 'Record not found' }

function buildOwnRecordsError(verb: 'edit' | 'delete') {
  return createError({ statusCode: 403, statusMessage: `You can only ${verb} your own records` })
}

/** After a scoped write missed: what the caller can read of the record, if anything. */
function findReadableRecord(
  tableId: string,
  address: string,
  actor: Pick<IRecordActor, 'userId' | 'access'>,
) {
  return prisma.record.findUnique({
    where: buildRecordAddressWhere(
      tableId,
      address,
      buildRecordScopeWhere(actor.access.readScope, actor.userId),
    ),
    select: { createdById: true },
  })
}

/**
 * No `WITH … AS MATERIALIZED`: it builds every matching row before the `LIMIT` can discard any,
 * which measured three orders of magnitude slower for a common term.
 */
function listPageRows(where: Prisma.Sql, order: IRecordOrder, query: IRecordQuery) {
  const { page, pageSize } = query
  const offset = (page - 1) * pageSize
  const columns = Prisma.sql`id, "number", "createdById", data, "createdAt", "updatedAt"`

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
  actor: IRecordActor,
): Promise<IRecordPage> {
  const { page, pageSize, sort, filters, search } = query
  const resolvedFilters = await RelationService.resolveFilterTargets(fields, filters)
  const reader = { tableId, readScope: actor.access.readScope, userId: actor.userId }
  const where = buildRecordWhere(reader, fields, resolvedFilters, search)
  const order = buildRecordOrderBy(fields, sort)

  const [rows, counts] = await prisma.$transaction([
    listPageRows(where, order, query),
    countMatchingRecords(where),
  ])

  const records = rows.map((row) => toSharedRecord(row, fields))
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
  actor: IRecordActor,
): Promise<IRecordDetail> {
  const row = await prisma.record.findUnique({
    where: buildRecordAddressWhere(
      table.id,
      address,
      buildRecordScopeWhere(actor.access.readScope, actor.userId),
    ),
    select: recordWithAuthorsSelect,
  })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: recordErrors.notFound })
  }

  const record = toRecordWithAuthors(row, fields)

  return {
    table,
    fields,
    record,
    linkedRecords: await RelationService.resolveLinkedRecords(fields, [record.data]),
  }
}

/** `fields` are the caller's visible ones; `data` holds only those they may write. */
async function createRecord(
  tableId: string,
  fields: IField[],
  data: TRecordData,
  actor: IRecordActor,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data, actor)

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
          createdById: actor.userId,
          updatedById: actor.userId,
        },
        select: recordSelect,
      })
    })

    return toSharedRecord(record, fields)
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }
}

/**
 * `data` holds only the fields the caller may write, merged over the stored data so every other
 * keeps its value. The caller's update scope and the version they read are both in the `where`,
 * so neither a save racing another nor a record changing hands can slip past them. A miss is told
 * apart afterwards, scope before version: a record they read but may not edit is a 403 whatever its
 * version, one they may edit is a 412, one gone or out of their sight is the usual 404.
 */
async function updateRecord(
  tableId: string,
  fields: IField[],
  address: string,
  data: TRecordData,
  actor: IRecordActor,
  expectedUpdatedAt?: Date,
): Promise<IRecord> {
  await RelationService.assertRelationTargets(fields, data, actor, async () => {
    const stored = await prisma.record.findUnique({
      where: buildRecordAddressWhere(tableId, address),
      select: { data: true },
    })
    return (stored?.data as TRecordData | null | undefined) ?? null
  })

  let rows: TRecordRow[]
  try {
    rows = await prisma.$queryRaw<TRecordRow[]>(
      buildRecordMergeUpdate({
        tableId,
        address,
        patch: data,
        userId: actor.userId,
        updateScope: actor.access.updateScope,
        expectedUpdatedAt,
        now: new Date(),
      }),
    )
  } catch (error) {
    throw toHttpError(error, recordErrors)
  }

  const [row] = rows
  if (row) return toSharedRecord(row, fields)

  const current = await findReadableRecord(tableId, address, actor)
  if (current && !canUpdateRecord(actor.access, current, actor.userId)) {
    throw buildOwnRecordsError('edit')
  }
  if (current && expectedUpdatedAt) throw buildStaleWriteError('record')
  throw createError({ statusCode: 404, statusMessage: recordErrors.notFound })
}

/**
 * The count moves only after the delete found its row: a missing one throws before it. The scope
 * is in the `where`; a miss on a record the caller reads is theirs to be refused, not a 404.
 */
async function deleteRecord(
  tableId: string,
  address: string,
  actor: Pick<IRecordActor, 'userId' | 'access'>,
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.record.delete({
        where: buildRecordAddressWhere(
          tableId,
          address,
          buildRecordScopeWhere(actor.access.deleteScope, actor.userId),
        ),
      })
      await tx.table.update({
        where: { id: tableId },
        data: { recordCount: { decrement: 1 } },
        select: { id: true },
      })
    })
  } catch (error) {
    if (isMissingRow(error)) {
      const current = await findReadableRecord(tableId, address, actor)
      if (current && !canDeleteRecord(actor.access, current, actor.userId)) {
        throw buildOwnRecordsError('delete')
      }
    }
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
