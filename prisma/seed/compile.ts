import { MULTI_VALUE_BY_TYPE } from '#shared/field-types/registry'
import { buildFieldKey } from '#server/utils/field-key'
import { fieldInputSchema } from '#shared/validation/field'
import { buildRecordSchema } from '#shared/validation/record'
import type { IField, IFieldOptions } from '#shared/types/field'
import type { TRecordData, TRecordValue } from '#shared/types/record'
import { idFor } from '~~/prisma/seed/ids'
import { timestampsFor } from '~~/prisma/seed/timestamps'
import type { ISeedField, ISeedTable, TSeedValue } from '~~/prisma/seed/dataset/types'

/**
 * Turns the dataset into rows. Pure, and must stay so: `server/db/prisma.ts` constructs a real
 * client at module load, which is why `FieldService.buildOptions` is not reused.
 */

export interface ICompiledRecord {
  ref: string
  id: string
  number: number
  data: TRecordData
  createdAt: Date
  updatedAt: Date
}

export interface ICompiledTable {
  id: string
  number: number
  name: string
  fields: IField[]
  records: ICompiledRecord[]
}

function requirePresent<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

function buildKeyIndex(tables: ISeedTable[]): Map<string, Map<string, string>> {
  return new Map(
    tables.map((table) => {
      const existing: Pick<IField, 'key' | 'type'>[] = []

      return [
        table.key,
        new Map(
          table.fields.map((seed) => {
            const key = buildFieldKey(seed.name, seed.type, existing)
            existing.push({ key, type: seed.type })
            return [seed.name, key]
          }),
        ),
      ]
    }),
  )
}

function optionsFor(
  seed: ISeedField,
  targetTableId: string | undefined,
  labelFieldKey: string | undefined,
): IFieldOptions | null {
  const options: IFieldOptions = {}

  if (seed.choices !== undefined) options.choices = seed.choices
  if (targetTableId !== undefined) options.targetTableId = targetTableId
  if (labelFieldKey !== undefined) options.labelFieldKey = labelFieldKey
  if (MULTI_VALUE_BY_TYPE[seed.type]) options.multiple = seed.multiple === true

  return Object.keys(options).length > 0 ? options : null
}

function resolveValue(
  field: IField,
  value: TSeedValue,
  recordIdByRef: Map<string, string>,
): TRecordValue {
  if (field.type !== 'RELATION' || value === null) return value

  const resolve = (ref: TSeedValue) =>
    requirePresent(
      typeof ref === 'string' ? recordIdByRef.get(ref) : undefined,
      `${field.name}: no seeded record is named "${String(ref)}"`,
    )

  return Array.isArray(value) ? value.map(resolve) : resolve(value)
}

export function compileDataset(tables: ISeedTable[]): ICompiledTable[] {
  const tableIdByKey = new Map(tables.map((table) => [table.key, idFor(`table:${table.key}`)]))
  const keyIndex = buildKeyIndex(tables)

  const recordIdByRef = new Map(
    tables.flatMap((table) => table.records.map((record) => [record.ref, idFor(record.ref)])),
  )

  return tables.map((table, tableIndex): ICompiledTable => {
    const keys = requirePresent(keyIndex.get(table.key), `Unknown table "${table.key}"`)

    const fields = table.fields.map((seed, fieldIndex): IField => {
      const target = seed.target
      const targetTableId =
        target === undefined
          ? undefined
          : requirePresent(tableIdByKey.get(target), `${seed.name}: unknown target "${target}"`)

      const labelFieldKey =
        target === undefined || seed.labelField === undefined
          ? undefined
          : requirePresent(
              keyIndex.get(target)?.get(seed.labelField),
              `${seed.name}: "${seed.labelField}" is not a field of "${target}"`,
            )

      const input = fieldInputSchema.parse({
        name: seed.name,
        type: seed.type,
        required: seed.required ?? false,
        choices: seed.choices ?? [],
        targetTableId: targetTableId ?? '',
        labelFieldKey: labelFieldKey ?? '',
        multiple: seed.multiple ?? false,
        indexed: seed.indexed ?? false,
      })

      return {
        id: idFor(`field:${table.key}:${seed.name}`),
        name: input.name,
        key: requirePresent(keys.get(seed.name), `${seed.name}: no key was derived`),
        type: input.type,
        required: input.required,
        options: optionsFor(seed, targetTableId, labelFieldKey),
        order: fieldIndex,
        indexed: input.indexed,
      }
    })

    const schema = buildRecordSchema(fields)

    const records = table.records.map((record, recordIndex): ICompiledRecord => {
      const data = Object.fromEntries(
        fields.map((field, fieldIndex) => {
          const name = requirePresent(
            table.fields[fieldIndex]?.name,
            `${table.name}: field ${fieldIndex} has no declaration`,
          )

          return [field.key, resolveValue(field, record.values[name] ?? null, recordIdByRef)]
        }),
      )

      const parsed = schema.safeParse(data)
      if (!parsed.success) {
        throw new Error(
          `${table.name} / ${record.ref}: ${parsed.error.issues
            .map((issue) => `${issue.path.join('.')} — ${issue.message}`)
            .join('; ')}`,
        )
      }

      return {
        ref: record.ref,
        id: requirePresent(recordIdByRef.get(record.ref), `No id for "${record.ref}"`),
        number: recordIndex + 1,
        data: parsed.data,
        ...timestampsFor(record.ref),
      }
    })

    return {
      id: requirePresent(tableIdByKey.get(table.key), `No id for "${table.key}"`),
      number: tableIndex + 1,
      name: table.name,
      fields,
      records,
    }
  })
}
