import type { Prisma } from '#server/generated/prisma/client'
import type { IRecord, IRecordWithAuthors, TRecordData } from '#shared/types/record'
import { parseAddressNumber } from '#shared/utils/address'
import { toUserRef, userRefSelect } from '#server/db/users'

export function buildRecordAddressWhere(
  tableId: string,
  address: string,
): Prisma.RecordWhereUniqueInput {
  const number = parseAddressNumber(address)

  return number === 0 ? { id: address, tableId } : { tableId_number: { tableId, number } }
}

export const recordSelect = {
  id: true,
  number: true,
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
