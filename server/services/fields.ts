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

/**
 * Brings a field's indexes in line **without making the caller wait**.
 *
 * `CREATE INDEX CONCURRENTLY` runs for minutes on a large table — a trigram GIN over a million
 * rows took over two — and blocks no writes, so waiting would buy only a response that reports
 * the outcome. The trade: a failure reaches the error log rather than the user, and the index is
 * absent until something asks again. `reconcileFieldIndexes` is the recovery path.
 */
function recordBackgroundFailure(error: unknown): void {
  // Straight to the sink rather than rethrown: Nitro's `error` hook only sees faults on the
  // request path, which this has left, so an uncaught throw would reach `uncaughtException`
  // and take the process down over an index that failed to build
  recordErrorEntry(buildErrorLogEntry(error, null, new Date()))
}

function syncIndexesInBackground(field: IField): void {
  void syncFieldIndexes(field).catch(recordBackgroundFailure)
}

/**
 * SELECT stores its choices, RELATION its target and label field; other types have none.
 * Both multi-capable types carry their cardinality alongside — the schema has already refused
 * `multiple` on a type that has no list form, so nothing needs re-checking here.
 */
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
 * Rewrites every stored value of one field into a single-element array, in the same transaction
 * as the field update so the metadata and the rows it describes move together.
 *
 * Non-destructive and idempotent: an array is skipped, and so is a missing or JSON-null value —
 * `[null]` would be a value where there was none. The `?` operator rather than `jsonb_exists`,
 * for one rule with `containsAny`; a literal `?` is a placeholder token on Prisma's *other*
 * drivers, not on the `adapter-pg` this project uses.
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

  // Retargeting would orphan every id already stored, so the target is immutable like the
  // key and the type. The label field is pure display and stays editable.
  const currentTarget = currentOptions?.targetTableId
  if (currentTarget !== undefined && currentTarget !== input.targetTableId) {
    throw createError({ statusCode: 400, statusMessage: 'Relation target cannot be changed' })
  }

  // Cardinality is one-way: widening is a migration this can perform, where narrowing would
  // discard every value past the first with no rule for which survives
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
          indexed: input.indexed,
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

    const saved = toSharedField(updated)
    // Outside the transaction, since `CONCURRENTLY` is refused inside one. Widening also
    // changes which index a field wants — a multi-value SELECT filters through GIN where a
    // single-value one uses a B-tree — so this runs on every update.
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

  // After the delete succeeded: dropping one for a field still present would quietly slow the
  // queries using it
  void dropFieldIndexes(fieldId).catch(recordBackgroundFailure)
}

/**
 * The field rules a handler may reach. `buildOptions` is public because a new field type adds a
 * branch to it (`CLAUDE.md` §9); `widenToList` is not — it is an implementation detail of
 * widening, and nothing outside this module has a reason to run it.
 */
export const FieldService = {
  buildOptions,
  listFields,
  createField,
  updateField,
  deleteField,
}
