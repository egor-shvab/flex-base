import { beforeEach, describe, expect, it } from 'vitest'
import { createField as createFieldService, updateField } from '#server/services/fields'
import { prisma } from '#server/utils/prisma'
import type { TRecordData } from '#shared/types/record'
import { fieldSchema, type TFieldInput } from '#shared/validation/field'
import { createField, createRecord, createTable, createUser } from '~~/test/integration/seed'

let tableId: string

const input = (overrides: Partial<TFieldInput> & Pick<TFieldInput, 'type'>): TFieldInput =>
  fieldSchema.parse({ name: 'Stage', ...overrides })

const selectInput = (multiple: boolean) =>
  fieldSchema.parse({
    name: 'Stage',
    type: 'SELECT',
    choices: [{ value: 'Won' }, { value: 'Lost' }],
    multiple,
  })

/** The stored value of one key, straight from the column. */
async function storedValue(recordId: string, key: string) {
  const row = await prisma.record.findUniqueOrThrow({
    where: { id: recordId },
    select: { data: true },
  })

  return (row.data as Record<string, unknown>)[key]
}

beforeEach(async () => {
  const table = await createTable((await createUser()).id)
  tableId = table.id
})

/**
 * The raw-SQL migration that runs when a field is widened. It rewrites stored rows, so what it
 * does to values the unit suite can only assert *was invoked* is the whole question here.
 */
describe('widening a field migrates the rows it describes', () => {
  async function widen(stored: TRecordData) {
    const field = await createField(tableId, {
      key: 'stage',
      type: 'SELECT',
      options: { choices: [{ value: 'Won', color: 'gray' }], multiple: false },
    })
    const record = await createRecord(tableId, stored)

    await updateField(tableId, field.id, selectInput(true))

    return { recordId: record.id, field }
  }

  it('wraps a scalar in a one-element list', async () => {
    const { recordId } = await widen({ stage: 'Won' })

    expect(await storedValue(recordId, 'stage')).toEqual(['Won'])
  })

  it('leaves a value that is already a list alone', async () => {
    const { recordId } = await widen({ stage: ['Won', 'Lost'] })

    expect(await storedValue(recordId, 'stage')).toEqual(['Won', 'Lost'])
  })

  /** `[null]` would be a value where the record had none. */
  it('leaves a JSON null alone rather than wrapping it', async () => {
    const { recordId } = await widen({ stage: null })

    expect(await storedValue(recordId, 'stage')).toBeNull()
  })

  it('leaves a record that never had the key alone', async () => {
    const { recordId } = await widen({ company: 'Acme' })

    expect(await storedValue(recordId, 'stage')).toBeUndefined()
    expect(await storedValue(recordId, 'company')).toBe('Acme')
  })

  it('touches no other key on the row', async () => {
    const { recordId } = await widen({ stage: 'Won', company: 'Acme' })

    expect(await storedValue(recordId, 'company')).toBe('Acme')
  })

  it('is idempotent — widening again wraps nothing twice', async () => {
    const { recordId, field } = await widen({ stage: 'Won' })

    await updateField(tableId, field.id, selectInput(true))

    expect(await storedValue(recordId, 'stage')).toEqual(['Won'])
  })

  it('leaves another table’s rows untouched', async () => {
    const other = await createTable((await createUser()).id)
    await createField(other.id, {
      key: 'stage',
      type: 'SELECT',
      options: { choices: [{ value: 'Won', color: 'gray' }] },
    })
    const elsewhere = await createRecord(other.id, { stage: 'Won' })

    await widen({ stage: 'Won' })

    expect(await storedValue(elsewhere.id, 'stage')).toBe('Won')
  })

  it('migrates every row of the table, not just the first', async () => {
    const field = await createField(tableId, {
      key: 'stage',
      type: 'SELECT',
      options: { choices: [{ value: 'Won', color: 'gray' }], multiple: false },
    })
    const rows = [
      await createRecord(tableId, { stage: 'Won' }),
      await createRecord(tableId, { stage: 'Lost' }),
      await createRecord(tableId, { stage: 'Won' }),
    ]

    await updateField(tableId, field.id, selectInput(true))

    for (const row of rows) {
      expect(Array.isArray(await storedValue(row.id, 'stage'))).toBe(true)
    }
  })

  /**
   * The metadata and the rows it describes move together — a field left single-value over rows
   * already rewritten as lists would read every one of them as invalid, and the reverse would
   * drop every value but the first. Asserted as one committed state rather than as two writes.
   */
  it('commits the metadata and the migrated rows as one state', async () => {
    const { recordId, field } = await widen({ stage: 'Won' })

    const stored = await prisma.field.findUniqueOrThrow({
      where: { id: field.id },
      select: { options: true },
    })

    expect(stored.options).toMatchObject({ multiple: true })
    expect(await storedValue(recordId, 'stage')).toEqual(['Won'])
  })

  it('does not migrate rows when the field was not actually widened', async () => {
    const field = await createField(tableId, {
      key: 'stage',
      type: 'SELECT',
      options: { choices: [{ value: 'Won', color: 'gray' }], multiple: false },
    })
    const record = await createRecord(tableId, { stage: 'Won' })

    await updateField(tableId, field.id, selectInput(false))

    expect(await storedValue(record.id, 'stage')).toBe('Won')
  })
})

describe('field keys are unique per table, in the database', () => {
  it('refuses a second field with a key already taken', async () => {
    await createField(tableId, { key: 'stage', type: 'TEXT' })

    await expect(
      prisma.field.create({ data: { tableId, key: 'stage', name: 'Stage', type: 'TEXT' } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('lets the service derive a free key instead of colliding', async () => {
    await createFieldService(tableId, input({ type: 'TEXT', name: 'Stage' }))
    const second = await createFieldService(tableId, input({ type: 'TEXT', name: 'Stage' }))

    expect(second.key).toBe('stage_2')
  })

  it('allows the same key on a different table', async () => {
    const other = await createTable((await createUser()).id)
    await createField(tableId, { key: 'stage', type: 'TEXT' })

    await expect(createField(other.id, { key: 'stage', type: 'TEXT' })).resolves.toMatchObject({
      key: 'stage',
    })
  })
})

describe('deleting a field', () => {
  it('leaves the records standing, values and all', async () => {
    const field = await createField(tableId, { key: 'stage', type: 'TEXT' })
    const record = await createRecord(tableId, { stage: 'Won', company: 'Acme' })

    await prisma.field.delete({ where: { id: field.id } })

    // The value is orphaned rather than scrubbed — nothing reads it, and nothing rewrites rows
    expect(await storedValue(record.id, 'company')).toBe('Acme')
  })
})
