import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'
import {
  dropFieldIndexes,
  reconcileFieldIndexes,
  syncFieldIndexes,
  type IReconcileReport,
} from '#server/db/field-indexes'
import { fieldSelect, toFieldOptions, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import { RelationService } from '#server/services/relations'
import { recordBackgroundFailure } from '#server/utils/error-log-file'
import { buildStaleWriteError, toHttpError } from '#server/utils/http-errors'
import { isMissingRow } from '#server/db/prisma-errors'
import { buildFieldKey } from '#server/utils/field-key'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

export const MAX_TABLE_FIELDS = 200

const fieldErrors = {
  conflict: 'A field with this name already exists',
  notFound: 'Field not found',
}

const indexWorkByField = new Map<string, Promise<void>>()

/**
 * One field's index DDL runs one job at a time, in the order the edits were saved: two overlapping
 * syncs could drop an index the other is building and end on a state no edit asked for. Each job
 * reads the field as it was saved, so the last one leaves the last wanted set.
 */
function queueIndexWork(fieldId: string, work: () => Promise<void>): void {
  const previous = indexWorkByField.get(fieldId) ?? Promise.resolve()
  const next = previous.then(work).catch(recordBackgroundFailure)
  indexWorkByField.set(fieldId, next)

  void next.then(() => {
    if (indexWorkByField.get(fieldId) === next) indexWorkByField.delete(fieldId)
  })
}

function syncIndexesInBackground(tableId: string, field: IField): void {
  queueIndexWork(field.id, () => syncFieldIndexes(tableId, field))
}

/**
 * Run once at start-up: indexes built to an older shape, or left by a sync the process did not live
 * to finish, are only ever repaired here.
 */
function reconcileIndexes(): Promise<IReconcileReport> {
  return reconcileFieldIndexes()
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

/**
 * In the same transaction as the field's delete: once the key is free a new field may take it, and
 * must not inherit — or fail to cast — what the old one stored.
 */
function clearFieldValues(tx: Prisma.TransactionClient, tableId: string, key: string) {
  return tx.$executeRaw`
    UPDATE "Record"
    SET data = data - ${key}::text
    WHERE "tableId" = ${tableId} AND data ? ${key}::text
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

  // Counted from the read above, not locked: two creates racing past the cap by one is accepted,
  // as for roles
  if (existing.length >= MAX_TABLE_FIELDS) {
    throw createError({
      statusCode: 409,
      statusMessage: `A table can have at most ${MAX_TABLE_FIELDS} fields`,
    })
  }

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
    syncIndexesInBackground(tableId, created)

    return created
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }
}

/** Given the version the caller read, the write lands only on that version (as `updateRecord`). */
async function updateField(
  tableId: string,
  fieldId: string,
  input: TFieldInput,
  expectedUpdatedAt?: Date,
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

  const currentOptions = toFieldOptions(fieldId, field.options)

  const currentTarget = currentOptions?.targetTableId
  if (currentTarget !== undefined && currentTarget !== input.targetTableId) {
    throw createError({ statusCode: 400, statusMessage: 'Relation target cannot be changed' })
  }

  const isStoredMultiple = currentOptions?.multiple === true
  if (isStoredMultiple && !input.multiple) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A multi-value field cannot be changed back to a single value',
    })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.field.update({
        where: expectedUpdatedAt
          ? { id: fieldId, tableId, updatedAt: expectedUpdatedAt }
          : { id: fieldId, tableId },
        data: {
          name: input.name,
          required: input.required,
          options: buildOptions(input),
          indexed: input.indexed,
        },
        select: fieldSelect,
      })

      if (!isStoredMultiple && input.multiple) {
        await widenToList(tx, tableId, field.key)
      }

      return row
    })

    const saved = toSharedField(updated)
    // Outside the transaction, which refuses `CONCURRENTLY`; on every update, since widening
    // changes which index a field wants
    syncIndexesInBackground(tableId, saved)

    return saved
  } catch (error) {
    if (expectedUpdatedAt && isMissingRow(error)) {
      const current = await prisma.field.findFirst({
        where: { id: fieldId, tableId },
        select: { id: true },
      })
      if (current) throw buildStaleWriteError('field')
    }
    throw toHttpError(error, fieldErrors)
  }
}

async function deleteField(workspaceId: string, tableId: string, fieldId: string) {
  const field = await prisma.field.findFirst({
    where: { id: fieldId, tableId },
    select: { key: true },
  })
  if (!field) {
    throw createError({ statusCode: 404, statusMessage: fieldErrors.notFound })
  }

  await RelationService.assertNotRelationTarget(workspaceId, tableId, field.key)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.field.delete({ where: { id: fieldId, tableId } })
      await clearFieldValues(tx, tableId, field.key)
    })
  } catch (error) {
    throw toHttpError(error, fieldErrors)
  }

  queueIndexWork(fieldId, () => dropFieldIndexes([fieldId]))
}

export const FieldService = {
  buildOptions,
  listFields,
  reconcileIndexes,
  createField,
  updateField,
  deleteField,
}
