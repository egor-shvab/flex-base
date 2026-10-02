import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import { dropFieldIndexes, syncFieldIndexes } from '#server/db/field-indexes'
import { fieldSelect, toFieldOptions, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import { buildErrorLogEntry } from '#server/utils/error-log'
import { recordErrorEntry } from '#server/utils/error-log-file'
import { toHttpError } from '#server/utils/http-errors'
import { buildFieldKey } from '#server/utils/field-key'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

const fieldErrors = {
  conflict: 'A field with this name already exists',
  notFound: 'Field not found',
}

function recordBackgroundFailure(error: unknown): void {
  // Not rethrown: off the request path an uncaught throw would take the process down
  recordErrorEntry(buildErrorLogEntry(error, null, new Date()))
}

function syncIndexesInBackground(field: IField): void {
  void syncFieldIndexes(field).catch(recordBackgroundFailure)
}

function buildOptions(input: TFieldInput): Prisma.InputJsonValue | typeof Prisma.JsonNull {
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
 * Idempotent: an array is skipped, and so is a missing or JSON-null value. A literal `?` is a
 * placeholder token on Prisma's other drivers, not on `adapter-pg`.
 */
function widenToList(tx: Prisma.TransactionClient, tableId: string, key: string) {
  return tx.$executeRaw`
    UPDATE "Record"
    SET data = jsonb_set(data, ARRAY[${key}::text], jsonb_build_array(data -> ${key}::text))
    WHERE "tableId" = ${tableId}
      AND data ? ${key}::text
      AND jsonb_typeof(data -> ${key}::text) NOT IN ('array', 'null')
  `
}

async function listFields(tableId: string): Promise<IField[]> {
  const fields = await prisma.field.findMany({
    where: { tableId },
    orderBy: { order: 'asc' },
    select: fieldSelect,
  })
  return fields.map(toSharedField)
}

async function createField(tableId: string, input: TFieldInput): Promise<IField> {
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
        indexed: input.indexed,
      },
      select: fieldSelect,
    })

    const created = toSharedField(field)
    syncIndexesInBackground(created)

    return created
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }
}

async function updateField(tableId: string, fieldId: string, input: TFieldInput): Promise<IField> {
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

  const currentTarget = currentOptions?.targetTableId
  if (currentTarget !== undefined && currentTarget !== input.targetTableId) {
    throw createError({ statusCode: 400, statusMessage: 'Relation target cannot be changed' })
  }

  const wasMultiple = currentOptions?.multiple === true
  if (wasMultiple && !input.multiple) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A multi-value field cannot be changed back to a single value',
    })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.field.update({
        where: { id: fieldId, tableId },
        data: {
          name: input.name,
          required: input.required,
          options: buildOptions(input),
          indexed: input.indexed,
        },
        select: fieldSelect,
      })

      if (!wasMultiple && input.multiple) {
        await widenToList(tx, tableId, field.key)
      }

      return row
    })

    const saved = toSharedField(updated)
    // Outside the transaction, which refuses `CONCURRENTLY`; on every update, since widening
    // changes which index a field wants
    syncIndexesInBackground(saved)

    return saved
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }
}

async function deleteField(tableId: string, fieldId: string) {
  try {
    await prisma.field.delete({ where: { id: fieldId, tableId } })
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }

  void dropFieldIndexes(fieldId).catch(recordBackgroundFailure)
}

export const FieldService = {
  buildOptions,
  listFields,
  createField,
  updateField,
  deleteField,
}
