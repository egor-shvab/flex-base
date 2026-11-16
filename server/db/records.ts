import type { Prisma } from '#server/generated/prisma/client'
import type { IRecord, IRecordWithAuthors, TRecordData } from '#shared/types/record'
import type { TRecordScope } from '#shared/types/workspace'
import { parseAddressNumber } from '#shared/utils/address'
import { toUserRef, userRefSelect } from '#server/db/users'

/** What may narrow a lookup by address: a unique where cannot take another `id` condition. */
type TRecordNarrowing = Pick<Prisma.RecordWhereInput, 'createdById' | 'updatedAt' | 'AND'>

/** `scope` narrows the one record further, from `buildRecordScopeWhere`. */
export function buildRecordAddressWhere(
  tableId: string,
  address: string,
  scope: TRecordNarrowing = {},
): Prisma.RecordWhereUniqueInput {
  const number = parseAddressNumber(address)

  return number === 0
    ? { ...scope, id: address, tableId }
    : { ...scope, tableId_number: { tableId, number } }
}

/** The records of a table a scope reaches for the caller. `NONE` reaches none. */
export function buildRecordScopeWhere(scope: TRecordScope, userId: string): TRecordNarrowing {
  if (scope === 'ALL') return {}
  if (scope === 'OWN') return { createdById: userId }
  return { AND: [{ id: { in: [] } }] }
}

export const recordSelect = {
  id: true,
  number: true,
  createdById: true,
  data: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RecordSelect

export const recordWithAuthorsSelect = {
  ...recordSelect,
  createdBy: { select: userRefSelect },
  updatedBy: { select: userRefSelect },
} satisfies Prisma.RecordSelect

export type TRecordRow = Prisma.RecordGetPayload<{ select: typeof recordSelect }>
export type TRecordWithAuthorsRow = Prisma.RecordGetPayload<{
  select: typeof recordWithAuthorsSelect
}>

export function toSharedRecord(record: TRecordRow): IRecord {
  return {
    id: record.id,
    number: record.number,
    createdById: record.createdById,
    data: (record.data as TRecordData | null) ?? {},
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function toRecordWithAuthors(record: TRecordWithAuthorsRow): IRecordWithAuthors {
  return {
    ...toSharedRecord(record),
    createdBy: toUserRef(record.createdBy),
    updatedBy: toUserRef(record.updatedBy),
  }
}

export function toJsonData(data: TRecordData): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject
}
