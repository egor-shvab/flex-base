import { beforeEach, describe, expect, it } from 'vitest'
import { RecordService } from '#server/services/records'
import { prisma } from '#server/db/prisma'
import { DEFAULT_SORT_DIRECTION, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecordQuery } from '#shared/types/record'
import { createFields, createTable, createUser } from '~~/test/integration/seed'

let tableId: string
let fields: IField[]

const query = (overrides: Partial<IRecordQuery> = {}): IRecordQuery => ({
  page: 1,
  pageSize: 50,
  sort: { key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION },
  filters: {},
  search: '',
  ...overrides,
})

beforeEach(async () => {
  const table = await createTable((await createUser()).id)
  tableId = table.id
  fields = await createFields(tableId, [{ key: 'company', type: 'TEXT' }])
})

/**
 * The counter is a high-water mark on the table row, incremented inside the same transaction
 * as the insert. The claim being tested is that the row lock makes concurrent creates queue
 * rather than race — which no stub can demonstrate, because a stub has no lock.
 */
describe('record numbers', () => {
  it('starts at one', async () => {
    const record = await RecordService.createRecord(tableId, fields, { company: 'Acme' })

    expect(record.number).toBe(1)
  })

  it('increments per record', async () => {
    await RecordService.createRecord(tableId, fields, { company: 'Acme' })
    await RecordService.createRecord(tableId, fields, { company: 'Beta' })
    const third = await RecordService.createRecord(tableId, fields, { company: 'Gamma' })

    expect(third.number).toBe(3)
  })

  it('gives every concurrent create a distinct number', async () => {
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        RecordService.createRecord(tableId, fields, { company: `Co ${index}` }),
      ),
    )

    const numbers = created.map((record) => record.number).sort((a, b) => a - b)

    expect(new Set(numbers).size).toBe(20)
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
  })

  /** A high-water mark, not a count — reusing a number would repoint every link to it. */
  it('never reuses the number of a deleted record', async () => {
    const first = await RecordService.createRecord(tableId, fields, { company: 'Acme' })
    await RecordService.createRecord(tableId, fields, { company: 'Beta' })

    await RecordService.deleteRecord(tableId, first.id)
    const next = await RecordService.createRecord(tableId, fields, { company: 'Gamma' })

    expect(next.number).toBe(3)
  })

  it('counts per table rather than globally', async () => {
    const other = await createTable((await createUser()).id)
    const otherFields = await createFields(other.id, [{ key: 'company', type: 'TEXT' }])

    await RecordService.createRecord(tableId, fields, { company: 'Acme' })
    const elsewhere = await RecordService.createRecord(other.id, otherFields, { company: 'Beta' })

    expect(elsewhere.number).toBe(1)
  })

  it('is unique per table in the database, not only by convention', async () => {
    await RecordService.createRecord(tableId, fields, { company: 'Acme' })

    await expect(
      prisma.record.create({ data: { tableId, number: 1, data: {} } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})

describe('writing a record', () => {
  it('round-trips the data through JSONB', async () => {
    const stored = await RecordService.createRecord(tableId, fields, { company: 'Acme' })
    const page = await RecordService.listRecords(tableId, fields, query())

    expect(page.records[0]).toMatchObject({ id: stored.id, data: { company: 'Acme' } })
  })

  it('replaces the data wholesale rather than merging', async () => {
    const record = await RecordService.createRecord(tableId, fields, { company: 'Acme' })

    await RecordService.updateRecord(tableId, fields, record.id, { company: 'Beta' })
    const page = await RecordService.listRecords(tableId, fields, query())

    expect(page.records[0]?.data).toEqual({ company: 'Beta' })
  })

  it('moves updatedAt but not createdAt', async () => {
    const record = await RecordService.createRecord(tableId, fields, { company: 'Acme' })
    const updated = await RecordService.updateRecord(tableId, fields, record.id, {
      company: 'Beta',
    })

    expect(updated.createdAt).toBe(record.createdAt)
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(record.updatedAt))
  })

  it('404s when updating a record of another table', async () => {
    const other = await createTable((await createUser()).id)
    const record = await RecordService.createRecord(tableId, fields, { company: 'Acme' })

    await expect(
      RecordService.updateRecord(other.id, fields, record.id, { company: 'Beta' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('404s when deleting a record of another table, leaving it in place', async () => {
    const other = await createTable((await createUser()).id)
    const record = await RecordService.createRecord(tableId, fields, { company: 'Acme' })

    await expect(RecordService.deleteRecord(other.id, record.id)).rejects.toMatchObject({
      statusCode: 404,
    })
    await expect(prisma.record.findUnique({ where: { id: record.id } })).resolves.not.toBeNull()
  })

  it('really removes the row on delete', async () => {
    const record = await RecordService.createRecord(tableId, fields, { company: 'Acme' })

    await RecordService.deleteRecord(tableId, record.id)

    await expect(prisma.record.findUnique({ where: { id: record.id } })).resolves.toBeNull()
  })
})
