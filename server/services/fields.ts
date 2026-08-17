import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { fieldSelect, toFieldOptions, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import { toHttpError } from '#server/db/prisma-errors'
import { buildFieldKey } from '#server/utils/field-key'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

const fieldErrors = {
  conflict: 'A field with this name already exists',
  notFound: 'Field not found',
}

/**
 * SELECT stores its choices, RELATION its target and label field; other types have none.
 * Both multi-capable types carry their cardinality alongside — the schema has already refused
 * `multiple` on a type that has no list form, so nothing needs re-checking here.
 */
export function buildOptions(input: TFieldInput): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (input.type === 'SELECT') return { choices: input.choices, multiple: input.multiple }
  if (input.type === 'RELATION') {
    return {
      targetTableId: input.targetTableId,
      labelFieldKey: input.labelFieldKey,
      multiple: input.multiple,
    }
  }
  return Prisma.JsonNull
}

/**
 * Rewrites every stored value of one field into a single-element array, so widening a field
 * that already holds data does not leave the whole table on the wrong shape. Runs in the same
 * transaction as the field update, so the metadata and the rows it describes move together.
 *
 * Non-destructive and idempotent: a value already an array is skipped, and so is a missing or
 * JSON-null one — there is nothing to wrap, and `[null]` would be a value where there was none.
 * `jsonb_exists` rather than the `?` operator, which is a placeholder token on Prisma's other
 * drivers and has a history of being mangled in raw SQL.
 */
function widenToList(tx: Prisma.TransactionClient, tableId: string, key: string) {
  return tx.$executeRaw`
    UPDATE "Record"
    SET data = jsonb_set(data, ARRAY[${key}::text], jsonb_build_array(data -> ${key}::text))
    WHERE "tableId" = ${tableId}
      AND jsonb_exists(data, ${key}::text)
      AND jsonb_typeof(data -> ${key}::text) NOT IN ('array', 'null')
  `
}

export async function listFields(tableId: string): Promise<IField[]> {
  const fields = await prisma.field.findMany({
    where: { tableId },
    orderBy: { order: 'asc' },
    select: fieldSelect,
  })
  return fields.map(toSharedField)
}

export async function createField(tableId: string, input: TFieldInput): Promise<IField> {
  const existing = await prisma.field.findMany({
    where: { tableId },
    select: { key: true, type: true, order: true },
  })
  const maxOrder = existing.reduce((max, field) => Math.max(max, field.order), -1)

  try {
    const field = await prisma.field.create({
      data: {
        tableId,
        name: input.name,
        key: buildFieldKey(input.name, input.type, existing),
        type: input.type,
        required: input.required,
        options: buildOptions(input),
        order: maxOrder + 1,
      },
      select: fieldSelect,
    })
    return toSharedField(field)
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
    select: { key: true, type: true, options: true },
  })
  if (!field) {
    throw createError({ statusCode: 404, statusMessage: fieldErrors.notFound })
  }
  if (field.type !== input.type) {
    throw createError({ statusCode: 400, statusMessage: 'Field type cannot be changed' })
  }

  const currentOptions = toFieldOptions(field.options)

  // Retargeting would orphan every id already stored, so the target is immutable like the
  // key and the type. The label field is pure display and stays editable.
  const currentTarget = currentOptions?.targetTableId
  if (currentTarget !== undefined && currentTarget !== input.targetTableId) {
    throw createError({ statusCode: 400, statusMessage: 'Relation target cannot be changed' })
  }

  // Cardinality is one-way. Widening is a migration this can perform; narrowing would have to
  // discard every value past the first, and there is no non-arbitrary rule for which survives.
  const wasMultiple = currentOptions?.multiple === true
  if (wasMultiple && !input.multiple) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A multi-value field cannot be changed back to a single value',
    })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // key is immutable — only name/required/options are updated
      const row = await tx.field.update({
        where: { id: fieldId, tableId },
        data: {
          name: input.name,
          required: input.required,
          options: buildOptions(input),
        },
        select: fieldSelect,
      })

      // The rows move with the metadata that describes them, or a value stored as a scalar
      // would be read by a schema and a projection that both expect a list
      if (!wasMultiple && input.multiple) {
        await widenToList(tx, tableId, field.key)
      }

      return row
    })

    return toSharedField(updated)
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
