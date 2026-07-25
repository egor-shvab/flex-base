import { Prisma } from '../generated/prisma/client'
import { prisma } from '../utils/prisma'
import type { TFieldInput } from '#shared/validation/field'

const fieldSelect = {
  id: true,
  name: true,
  key: true,
  type: true,
  required: true,
  options: true,
  order: true,
} satisfies Prisma.FieldSelect

/** Maps Prisma constraint errors to HTTP errors; rethrows anything else. */
function toHttpError(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return createError({
        statusCode: 409,
        statusMessage: 'A field with this name already exists',
      })
    }
    if (error.code === 'P2025') {
      return createError({ statusCode: 404, statusMessage: 'Field not found' })
    }
  }
  return error instanceof Error ? error : new Error(String(error))
}

/** Machine key from a display name: lowercase, non-alphanumerics → `_`. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field'
  )
}

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}_${suffix}`)) suffix++
  return `${base}_${suffix}`
}

/** SELECT stores its choices; other types have no options. */
function buildOptions(input: TFieldInput): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (input.type === 'SELECT') return { choices: input.choices }
  return Prisma.JsonNull
}

export function listFields(tableId: string) {
  return prisma.field.findMany({
    where: { tableId },
    orderBy: { order: 'asc' },
    select: fieldSelect,
  })
}

export async function createField(tableId: string, input: TFieldInput) {
  const existing = await prisma.field.findMany({
    where: { tableId },
    select: { key: true, order: true },
  })
  const takenKeys = new Set(existing.map((field) => field.key))
  const maxOrder = existing.reduce((max, field) => Math.max(max, field.order), -1)

  try {
    return await prisma.field.create({
      data: {
        tableId,
        name: input.name,
        key: uniqueKey(slugify(input.name), takenKeys),
        type: input.type,
        required: input.required,
        options: buildOptions(input),
        order: maxOrder + 1,
      },
      select: fieldSelect,
    })
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function updateField(tableId: string, fieldId: string, input: TFieldInput) {
  const field = await prisma.field.findFirst({
    where: { id: fieldId, tableId },
    select: { type: true },
  })
  if (!field) {
    throw createError({ statusCode: 404, statusMessage: 'Field not found' })
  }
  if (field.type !== input.type) {
    throw createError({ statusCode: 400, statusMessage: 'Field type cannot be changed' })
  }

  try {
    // key is immutable — only name/required/options are updated
    return await prisma.field.update({
      where: { id: fieldId, tableId },
      data: {
        name: input.name,
        required: input.required,
        options: buildOptions(input),
      },
      select: fieldSelect,
    })
  } catch (error) {
    throw toHttpError(error)
  }
}

export async function deleteField(tableId: string, fieldId: string) {
  try {
    await prisma.field.delete({ where: { id: fieldId, tableId } })
  } catch (error) {
    throw toHttpError(error)
  }
}
