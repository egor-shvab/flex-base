import type { Prisma } from '#server/generated/prisma/client'
import type { IRecord, TRecordData } from '#shared/types/record'

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
