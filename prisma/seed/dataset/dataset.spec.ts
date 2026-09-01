import { describe, expect, it } from 'vitest'
import { BADGE_COLORS } from '#shared/constants/color'
import { RESERVED_FIELD_KEYS, RESERVED_QUERY_PARAMS } from '#shared/constants/filter'
import { MULTI_VALUE_MAX_ITEMS, RECORD_PAGE_SIZE } from '#shared/constants/record'
import { isMultiValue } from '#shared/field-types/cardinality'
import { FIELD_TYPES } from '#shared/field-types/registry'
import { choiceValues } from '#shared/field-types/select'
import type { IField } from '#shared/types/field'
import { compileDataset } from '~~/prisma/seed/compile'
import { SEED_TABLES } from '~~/prisma/seed/dataset'
import { idFor } from '~~/prisma/seed/ids'

/**
 * The demo dataset, checked without a database.
 *
 * `compileDataset` already refuses a dataset the app would reject — it runs `fieldInputSchema`
 * over every field and `buildRecordSchema` over every record — so calling it here is most of the
 * suite. What the cases below add is everything that spans two tables, which no schema can see: a
 * relation ref pointing at the wrong table, a label field that does not exist on the target, an
 * id collision between two records.
 *
 * The last block is different in kind. It asserts that the demo still *demonstrates* what it was
 * built to: every field type, both cardinalities, the whole badge palette, and the empty,
 * single-row and multi-page list states. Those are the properties an edit quietly removes.
 */

const tables = compileDataset(SEED_TABLES)

const tableById = new Map(tables.map((table) => [table.id, table]))
const allFields = tables.flatMap((table) => table.fields)
const allRecords = tables.flatMap((table) => table.records)

/** Which table a record id belongs to — what a relation value has to agree with. */
const tableIdByRecordId = new Map(
  tables.flatMap((table) => table.records.map((record) => [record.id, table.id])),
)

const linkedIds = (field: IField, value: unknown): string[] => {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string')
  return typeof value === 'string' && value !== '' ? [value] : []
}

describe('the seed dataset', () => {
  it('compiles every table without a database', () => {
    expect(tables).toHaveLength(SEED_TABLES.length)
    expect(tables.every((table) => table.records.length === 0 || table.fields.length > 0)).toBe(
      true,
    )
  })

  it('names every table once, and every field once within its table', () => {
    const names = tables.map((table) => table.name)
    expect(new Set(names).size).toBe(names.length)

    for (const table of tables) {
      const fieldNames = table.fields.map((field) => field.name)
      expect(new Set(fieldNames).size, `${table.name} repeats a field name`).toBe(fieldNames.length)
    }
  })

  it('derives keys that are safe to inline into DDL and claim no reserved name', () => {
    // The guarantee `field-indexes.ts:assertSafeKey` rests on, asserted where the keys come from
    for (const field of allFields) {
      expect(field.key, `${field.name} derived an unsafe key`).toMatch(/^[a-z0-9_]+$/)
    }

    const reserved = new Set<string>([...RESERVED_QUERY_PARAMS, ...RESERVED_FIELD_KEYS])

    for (const table of tables) {
      const keys = table.fields.map((field) => field.key)
      expect(new Set(keys).size, `${table.name} repeats a field key`).toBe(keys.length)
      expect(keys.filter((key) => reserved.has(key))).toEqual([])
    }
  })

  it('numbers tables and records the way the services would', () => {
    expect(tables.map((table) => table.number)).toEqual(tables.map((_, index) => index + 1))

    for (const table of tables) {
      expect(
        table.records.map((record) => record.number),
        `${table.name} is not numbered 1..n`,
      ).toEqual(table.records.map((_, index) => index + 1))
    }
  })

  it('gives every table, field and record a distinct id', () => {
    const ids = [
      ...tables.map((table) => table.id),
      ...allFields.map((field) => field.id),
      ...allRecords.map((record) => record.id),
    ]

    expect(new Set(ids).size).toBe(ids.length)
    // The derivation itself, rather than only its outcome on today's refs
    expect(idFor('clients:northwind')).not.toBe(idFor('clients:helios'))
  })

  it('points every relation at a record of the table its field targets', () => {
    for (const table of tables) {
      for (const field of table.fields.filter((candidate) => candidate.type === 'RELATION')) {
        const targetTableId = field.options?.targetTableId
        expect(targetTableId, `${table.name}.${field.name} has no target`).toBeDefined()
        expect(tableById.has(targetTableId ?? '')).toBe(true)

        for (const record of table.records) {
          for (const id of linkedIds(field, record.data[field.key])) {
            expect(
              tableIdByRecordId.get(id),
              `${table.name}.${field.name} on ${record.ref} links outside its target`,
            ).toBe(targetTableId)
          }
        }
      }
    }
  })

  it('labels every relation by a field the target actually has', () => {
    for (const field of allFields.filter((candidate) => candidate.type === 'RELATION')) {
      const target = tableById.get(field.options?.targetTableId ?? '')
      const keys = (target?.fields ?? []).map((candidate) => candidate.key)

      expect(keys, `${field.name} labels by a field the target lacks`).toContain(
        field.options?.labelFieldKey,
      )
    }
  })

  it('stores only declared choices, without repeats, within the multi-value cap', () => {
    for (const table of tables) {
      for (const field of table.fields.filter((candidate) => candidate.type === 'SELECT')) {
        const allowed = new Set(choiceValues(field))

        for (const record of table.records) {
          const stored = record.data[field.key]
          const values = Array.isArray(stored) ? stored : stored === null ? [] : [stored]

          expect(new Set(values).size, `${record.ref} repeats a ${field.name} value`).toBe(
            values.length,
          )
          expect(values.length).toBeLessThanOrEqual(MULTI_VALUE_MAX_ITEMS)

          for (const value of values) {
            expect(
              allowed,
              `${record.ref}: "${String(value)}" is not a ${field.name} choice`,
            ).toContain(value)
          }
        }
      }
    }
  })

  it('stores a list exactly where cardinality says it should', () => {
    for (const table of tables) {
      for (const field of table.fields) {
        for (const record of table.records) {
          const stored = record.data[field.key]
          if (stored === null) continue

          expect(
            Array.isArray(stored),
            `${record.ref}.${field.key} is the wrong shape for its cardinality`,
          ).toBe(isMultiValue(field))
        }
      }
    }
  })

  it('keeps updatedAt at or after createdAt', () => {
    for (const record of allRecords) {
      expect(record.updatedAt.getTime()).toBeGreaterThanOrEqual(record.createdAt.getTime())
    }
  })
})

describe('what the seed demonstrates', () => {
  it('covers every field type and both cardinalities', () => {
    expect(new Set(allFields.map((field) => field.type))).toEqual(new Set(FIELD_TYPES))

    const multi = allFields.filter(isMultiValue)
    expect(new Set(multi.map((field) => field.type))).toEqual(new Set(['SELECT', 'RELATION']))
  })

  it('uses the whole badge palette', () => {
    const used = new Set(
      allFields.flatMap((field) => (field.options?.choices ?? []).map((choice) => choice.color)),
    )

    expect([...BADGE_COLORS].filter((color) => !used.has(color))).toEqual([])
  })

  it('links a table to itself, so the self-relation has a case', () => {
    const self = tables.filter((table) =>
      table.fields.some((field) => field.options?.targetTableId === table.id),
    )

    expect(self.map((table) => table.name)).not.toEqual([])
  })

  it('reaches the empty, single-row and multi-page list states', () => {
    const counts = tables.map((table) => table.records.length)

    expect(counts).toContain(0)
    expect(counts).toContain(1)
    expect(counts.some((count) => count > RECORD_PAGE_SIZE)).toBe(true)
  })

  it('leaves blanks in every shape a blank can take', () => {
    const values = allRecords.flatMap((record) => Object.values(record.data))

    expect(values).toContain(null)
    expect(values.some((value) => Array.isArray(value) && value.length === 0)).toBe(true)
    expect(values).toContain(false)
  })

  it('carries the numeric edges a NUMBER column allows', () => {
    const numbers = allRecords
      .flatMap((record) => Object.values(record.data))
      .filter((value): value is number => typeof value === 'number')

    expect(numbers.some((value) => value < 0)).toBe(true)
    expect(numbers).toContain(0)
    expect(numbers.some((value) => !Number.isInteger(value))).toBe(true)
  })
})
