import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/utils/prisma'
import { toHttpError } from '#server/utils/prisma-errors'
import type { IField, IFieldOptions } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

export const fieldSelect = {
  id: true,
  name: true,
  key: true,
  type: true,
  required: true,
  options: true,
  order: true,
} satisfies Prisma.FieldSelect

type TFieldRow = Prisma.FieldGetPayload<{ select: typeof fieldSelect }>

const fieldErrors = {
  conflict: 'A field with this name already exists',
  notFound: 'Field not found',
}

/**
 * Narrows Prisma's untyped `options` JSON onto the shared `IField` shape — the single
 * place that cast is allowed, so no call site has to trust the raw row.
 */
export function toFieldMetadata(field: TFieldRow): IField {
  return { ...field, options: (field.options as IFieldOptions | null) ?? null }
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

export async function listFields(tableId: string): Promise<IField[]> {
  const fields = await prisma.field.findMany({
    where: { tableId },
    orderBy: { order: 'asc' },
    select: fieldSelect,
  })
  return fields.map(toFieldMetadata)
}

export async function createField(tableId: string, input: TFieldInput): Promise<IField> {
  const existing = await prisma.field.findMany({
    where: { tableId },
    select: { key: true, order: true },
  })
  const takenKeys = new Set(existing.map((field) => field.key))
  const maxOrder = existing.reduce((max, field) => Math.max(max, field.order), -1)

  try {
    const field = await prisma.field.create({
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
    return toFieldMetadata(field)
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }
}

export async function updateField(
  tableId: string,
  fieldId: string,
  input: TFieldInput,
): Promise<IField> {
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
    const updated = await prisma.field.update({
      where: { id: fieldId, tableId },
      data: {
        name: input.name,
        required: input.required,
        options: buildOptions(input),
      },
      select: fieldSelect,
    })
    return toFieldMetadata(updated)
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }
}

export async function deleteField(tableId: string, fieldId: string) {
  try {
    await prisma.field.delete({ where: { id: fieldId, tableId } })
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }
}
