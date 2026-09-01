import type { Prisma } from '#server/generated/prisma/client'
import type { IRecord, TRecordData } from '#shared/types/record'
import { parseAddressNumber } from '#shared/utils/address'

/**
 * Which row a record address selects — the same rule `tableWhere` states one level up, and the
 * same two forms: the number a URL carries, or the cuid a relation stores and older links use.
 *
 * **Scoped by its table rather than by its owner**, and that asymmetry is deliberate: every
 * caller reaches this only after a handler factory has proven the table belongs to the user, so
 * the table id *is* the ownership scope by then.
 */
export function recordWhere(tableId: string, address: string): Prisma.RecordWhereUniqueInput {
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

export type TRecordRow = Prisma.RecordGetPayload<{ select: typeof recordSelect }>

/** Narrows Prisma's untyped JSONB column onto the shared record shape. */
export function toSharedRecord(record: TRecordRow): IRecord {
  return {
    id: record.id,
    number: record.number,
    data: (record.data as TRecordData | null) ?? {},
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

/** Validated payloads only ever contain declared field keys, so the cast is safe here. */
export function toJsonData(data: TRecordData): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject
}
