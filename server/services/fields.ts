import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/utils/prisma'
import { toHttpError } from '#server/utils/prisma-errors'
import type { IField, IFieldOptions, TFieldType } from '#shared/types/field'
import { RESERVED_FIELD_KEYS, RESERVED_QUERY_PARAMS } from '#shared/constants/filter'
import { filterParamNames } from '#shared/utils/filter'
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
 * Narrows Prisma's untyped `options` JSON — the single place that cast is allowed, so no
 * call site has to trust the raw column.
 */
function toFieldOptions(options: TFieldRow['options']): IFieldOptions | null {
  return (options as IFieldOptions | null) ?? null
}

/** The same, for a whole row: the shape every layer above the database speaks. */
export function toFieldMetadata(field: TFieldRow): IField {
  return { ...field, options: toFieldOptions(field.options) }
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

/**
 * A key must be free for every query param it would claim, not just for itself: filters
 * are named after the field (`price`, `price_from`, `price_to`), so a key may collide
 * with a reserved param or with another field's range bound.
 */
function uniqueKey(base: string, type: TFieldType, taken: Set<string>): string {
  const isFree = (key: string) =>
    !taken.has(key) && filterParamNames(key, type).every((name) => !taken.has(name))

  if (isFree(base)) return base
  let suffix = 2
  while (!isFree(`${base}_${suffix}`)) suffix++
  return `${base}_${suffix}`
}

/** SELECT stores its choices, RELATION its target and label field; other types have none. */
function buildOptions(input: TFieldInput): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (input.type === 'SELECT') return { choices: input.choices }
  if (input.type === 'RELATION') {
    return { targetTableId: input.targetTableId, labelFieldKey: input.labelFieldKey }
  }
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
    select: { key: true, type: true, order: true },
  })
  const takenKeys = new Set<string>([
    ...RESERVED_QUERY_PARAMS,
    ...RESERVED_FIELD_KEYS,
    ...existing.flatMap((field) => [field.key, ...filterParamNames(field.key, field.type)]),
  ])
  const maxOrder = existing.reduce((max, field) => Math.max(max, field.order), -1)

  try {
    const field = await prisma.field.create({
      data: {
        tableId,
        name: input.name,
        key: uniqueKey(slugify(input.name), input.type, takenKeys),
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
    select: { type: true, options: true },
  })
  if (!field) {
    throw createError({ statusCode: 404, statusMessage: fieldErrors.notFound })
  }
  if (field.type !== input.type) {
    throw createError({ statusCode: 400, statusMessage: 'Field type cannot be changed' })
  }

  // Retargeting would orphan every id already stored, so the target is immutable like the
  // key and the type. The label field is pure display and stays editable.
  const currentTarget = toFieldOptions(field.options)?.targetTableId
  if (currentTarget !== undefined && currentTarget !== input.targetTableId) {
    throw createError({ statusCode: 400, statusMessage: 'Relation target cannot be changed' })
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
