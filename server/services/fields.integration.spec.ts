import { beforeEach, describe, expect, it } from 'vitest'
import { FieldService } from '#server/services/fields'
import { RecordService } from '#server/services/records'
import { prisma } from '#server/db/prisma'
import type { TRecordData } from '#shared/types/record'
import { fieldInputSchema, type TFieldInput } from '#shared/validation/field'
import { createField, createRecord, createTable, createUser } from '~~/test/integration/seed'

let workspaceId: string
let tableId: string

const input = (overrides: Partial<TFieldInput> & Pick<TFieldInput, 'type'>): TFieldInput =>
  fieldInputSchema.parse({ name: 'Stage', ...overrides })

const selectInput = (multiple: boolean) =>
  fieldInputSchema.parse({
    name: 'Stage',
    type: 'SELECT',
    choices: [{ value: 'Won' }, { value: 'Lost' }],
    multiple,
  })

async function storedValue(recordId: string, key: string) {
  const row = await prisma.record.findUniqueOrThrow({
    where: { id: recordId },
    select: { data: true },
  })

  return (row.data as Record<string, unknown>)[key]
}

beforeEach(async () => {
  workspaceId = (await createUser()).workspace.id
  tableId = (await createTable(workspaceId)).id
})

describe('widening a field migrates the rows it describes', () => {
  async function widen(stored: TRecordData) {
    const field = await createField(tableId, {
      key: 'stage',
      type: 'SELECT',
      options: { choices: [{ value: 'Won', color: 'gray' }], multiple: false },
    })
    const record = await createRecord(tableId, stored)

    await FieldService.updateField(tableId, field.id, selectInput(true))

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

    await FieldService.updateField(tableId, field.id, selectInput(true))

    expect(await storedValue(recordId, 'stage')).toEqual(['Won'])
  })

  it('leaves another table’s rows untouched', async () => {
    const other = await createTable((await createUser()).workspace.id)
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

    await FieldService.updateField(tableId, field.id, selectInput(true))

    for (const row of rows) {
      expect(Array.isArray(await storedValue(row.id, 'stage'))).toBe(true)
    }
  })

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

    await FieldService.updateField(tableId, field.id, selectInput(false))

    expect(await storedValue(record.id, 'stage')).toBe('Won')
  })
})

describe('two fields created at once', () => {
  it('both land, under distinct keys, when their names slug alike', async () => {
    const created = await Promise.all([
      FieldService.createField(tableId, input({ type: 'TEXT', name: 'Price' })),
      FieldService.createField(tableId, input({ type: 'TEXT', name: 'price!' })),
      FieldService.createField(tableId, input({ type: 'TEXT', name: 'PRICE' })),
    ])

    expect(new Set(created.map((field) => field.key)).size).toBe(3)
    expect(created.map((field) => field.key).sort()).toEqual(['price', 'price_2', 'price_3'])
  })

  it('lists them in a stable order even if they share an order value', async () => {
    await Promise.all([
      FieldService.createField(tableId, input({ type: 'TEXT', name: 'Alpha' })),
      FieldService.createField(tableId, input({ type: 'TEXT', name: 'Beta' })),
    ])

    const first = (await FieldService.listFields(tableId)).map((field) => field.id)
    const second = (await FieldService.listFields(tableId)).map((field) => field.id)

    expect(second).toEqual(first)
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
    await FieldService.createField(tableId, input({ type: 'TEXT', name: 'Stage' }))
    const second = await FieldService.createField(tableId, input({ type: 'TEXT', name: 'Stage' }))

    expect(second.key).toBe('stage_2')
  })

  it('allows the same key on a different table', async () => {
    const other = await createTable((await createUser()).workspace.id)
    await createField(tableId, { key: 'stage', type: 'TEXT' })

    await expect(createField(other.id, { key: 'stage', type: 'TEXT' })).resolves.toMatchObject({
      key: 'stage',
    })
  })
})

describe('deleting a field', () => {
  it('clears its key from the table’s records and leaves every other key standing', async () => {
    const field = await createField(tableId, { key: 'stage', type: 'TEXT' })
    const record = await createRecord(tableId, { stage: 'Won', company: 'Acme' })

    await FieldService.deleteField(workspaceId, tableId, field.id)

    expect(await storedValue(record.id, 'stage')).toBeUndefined()
    expect(await storedValue(record.id, 'company')).toBe('Acme')
  })

  it('leaves another table’s value under the same key alone', async () => {
    const field = await createField(tableId, { key: 'stage', type: 'TEXT' })
    const other = await createTable(workspaceId, 'Other')
    await createField(other.id, { key: 'stage', type: 'TEXT' })
    const kept = await createRecord(other.id, { stage: 'Won' })

    await FieldService.deleteField(workspaceId, tableId, field.id)

    expect(await storedValue(kept.id, 'stage')).toBe('Won')
  })

  it('hands a re-created field of another type an empty column, so its filter runs', async () => {
    const text = await FieldService.createField(tableId, input({ type: 'TEXT', name: 'Amount' }))
    await createRecord(tableId, { amount: 'on request' })

    await FieldService.deleteField(workspaceId, tableId, text.id)
    const number = await FieldService.createField(
      tableId,
      input({ type: 'NUMBER', name: 'Amount' }),
    )

    expect(number.key).toBe('amount')
    const page = await RecordService.listRecords(tableId, [number], {
      page: 1,
      pageSize: 50,
      sort: { key: number.key, direction: 'asc' },
      filters: { amount: { from: 0, to: null } },
      search: '',
    })
    expect(page.records).toEqual([])
  })

  it('refuses while a relation shows it as its label, and keeps field and values', async () => {
    const label = await createField(tableId, { key: 'full_name', type: 'TEXT' })
    const record = await createRecord(tableId, { full_name: 'Ada' })
    const deals = await createTable(workspaceId, 'Deals')
    await createField(deals.id, {
      key: 'owner',
      name: 'Owner',
      type: 'RELATION',
      options: { targetTableId: tableId, labelFieldKey: 'full_name' },
    })

    await expect(FieldService.deleteField(workspaceId, tableId, label.id)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: '"Owner" in "Deals" shows this field as its label',
    })

    expect(await prisma.field.count({ where: { id: label.id } })).toBe(1)
    expect(await storedValue(record.id, 'full_name')).toBe('Ada')
  })

  it('lets a field go that a relation targets the table of but labels with another', async () => {
    const plain = await createField(tableId, { key: 'notes', type: 'TEXT' })
    const deals = await createTable(workspaceId, 'Deals')
    await createField(deals.id, {
      key: 'owner',
      type: 'RELATION',
      options: { targetTableId: tableId, labelFieldKey: 'full_name' },
    })

    await expect(FieldService.deleteField(workspaceId, tableId, plain.id)).resolves.toBeUndefined()
  })
})
