import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/utils/prisma'
import type { IField, IFieldOptions, TFieldType } from '#shared/types/field'
import type { TRecordData } from '#shared/types/record'

/**
 * Rows written straight through Prisma rather than through the services, so a spec about
 * `createRecord` is not seeded by `createRecord`. The one exception is `recordCounter`, which
 * is maintained by hand here for the same reason.
 */

let sequence = 0

/** Unique per call, so a case never collides with the row a previous one left behind. */
const unique = (prefix: string) => `${prefix}_${(sequence += 1)}`

export function createUser(email = `${unique('user')}@example.com`) {
  return prisma.user.create({
    data: { email, passwordHash: 'not-a-real-hash' },
    select: { id: true, email: true },
  })
}

export function createTable(userId: string, name = unique('Table')) {
  return prisma.table.create({
    data: { userId, name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  })
}

interface IFieldSeed {
  key: string
  type: TFieldType
  name?: string
  required?: boolean
  options?: IFieldOptions | null
  order?: number
}

export async function createField(tableId: string, seed: IFieldSeed): Promise<IField> {
  const field = await prisma.field.create({
    data: {
      tableId,
      key: seed.key,
      name: seed.name ?? seed.key,
      type: seed.type,
      required: seed.required ?? false,
      options: (seed.options as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
      order: seed.order ?? 0,
    },
    select: {
      id: true,
      name: true,
      key: true,
      type: true,
      required: true,
      options: true,
      order: true,
    },
  })

  return { ...field, options: (field.options as IFieldOptions | null) ?? null }
}

/** Several fields in declaration order, which is the order every reader depends on. */
export function createFields(tableId: string, seeds: IFieldSeed[]): Promise<IField[]> {
  return seeds.reduce<Promise<IField[]>>(
    async (previous, seed, index) => [
      ...(await previous),
      await createField(tableId, { order: index, ...seed }),
    ],
    Promise.resolve([]),
  )
}

/**
 * Timestamps a spec dictates rather than inherits. Settable only **on create**: `createdAt`
 * defaults to `now()` and `updatedAt` is `@updatedAt`, which Prisma overwrites on every update
 * — so there is no second seam, and a spec about how a timestamp column is queried has to
 * seed the row it wants in one statement.
 */
interface IRecordTimestamps {
  createdAt?: Date
  updatedAt?: Date
}

/**
 * A record with its number allocated the way the service would, so a spec that seeds rows and
 * then creates one through `createRecord` sees a continuous sequence.
 */
export async function createRecord(
  tableId: string,
  data: TRecordData = {},
  timestamps: IRecordTimestamps = {},
) {
  const { recordCounter } = await prisma.table.update({
    where: { id: tableId },
    data: { recordCounter: { increment: 1 } },
    select: { recordCounter: true },
  })

  return prisma.record.create({
    data: {
      tableId,
      number: recordCounter,
      data: data as Prisma.InputJsonObject,
      ...timestamps,
    },
    select: { id: true, number: true, data: true, createdAt: true, updatedAt: true },
  })
}

export function createRecords(tableId: string, rows: TRecordData[]) {
  return rows.reduce<Promise<{ id: string; number: number }[]>>(
    async (previous, row) => [...(await previous), await createRecord(tableId, row)],
    Promise.resolve([]),
  )
}
