import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import type { IField, IFieldOptions, TFieldType } from '#shared/types/field'
import type { TRecordData } from '#shared/types/record'

let sequence = 0

const unique = (prefix: string) => `${prefix}_${(sequence += 1)}`

export function createUser(email = `${unique('user')}@example.com`) {
  return prisma.user.create({
    data: { email, passwordHash: 'not-a-real-hash' },
    select: { id: true, email: true },
  })
}

export async function createTable(userId: string, name = unique('Table')) {
  const { tableCounter } = await prisma.user.update({
    where: { id: userId },
    data: { tableCounter: { increment: 1 } },
    select: { tableCounter: true },
  })

  return prisma.table.create({
    data: { userId, name, number: tableCounter },
    select: { id: true, number: true, name: true, createdAt: true, updatedAt: true },
  })
}

interface IFieldSeed {
  key: string
  type: TFieldType
  name?: string
  required?: boolean
  options?: IFieldOptions | null
  order?: number
  indexed?: boolean
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
      indexed: seed.indexed ?? false,
    },
    select: {
      id: true,
      name: true,
      key: true,
      type: true,
      required: true,
      options: true,
      order: true,
      indexed: true,
    },
  })

  return { ...field, options: (field.options as IFieldOptions | null) ?? null }
}

export function createFields(tableId: string, seeds: IFieldSeed[]): Promise<IField[]> {
  return seeds.reduce<Promise<IField[]>>(
    async (previous, seed, index) => [
      ...(await previous),
      await createField(tableId, { order: index, ...seed }),
    ],
    Promise.resolve([]),
  )
}

/** Settable only on create: `updatedAt` is `@updatedAt`, which Prisma overwrites on update. */
interface IRecordTimestamps {
  createdAt?: Date
  updatedAt?: Date
}

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
