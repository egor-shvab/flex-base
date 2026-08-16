import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import {
  createRecord,
  deleteRecord,
  getRecordDetail,
  listRecords,
  toSharedRecord,
  updateRecord,
} from '#server/services/records'
import { DEFAULT_SORT_DIR, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import type { IRecordQuery } from '#shared/types/record'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { relationField, textField } from '~~/test/fixtures'

vi.mock('#server/utils/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const TABLE_ID = 'tbl_deals'
const RECORD_ID = 'rec_1'
const table = { id: TABLE_ID, name: 'Deals' }
const fields = [textField('company')]

/** A row as Prisma returns it — `data` as opaque JSON, timestamps as `Date`. */
function row(overrides: Partial<{ id: string; number: number; data: Prisma.JsonValue }> = {}) {
  return {
    id: RECORD_ID,
    number: 1,
    data: { company: 'Acme' },
    createdAt: new Date('2026-01-05T09:14:00.000Z'),
    updatedAt: new Date('2026-02-11T16:30:00.000Z'),
    ...overrides,
  }
}

function query(overrides: Partial<IRecordQuery> = {}): IRecordQuery {
  return {
    page: 1,
    pageSize: 50,
    sort: { key: DEFAULT_SORT_KEY, dir: DEFAULT_SORT_DIR },
    filters: {},
    search: '',
    ...overrides,
  }
}

/** `listRecords` runs its rows and its count as one transaction, in that order. */
function stubPage(rows: unknown[], total: number) {
  prismaMock.$queryRaw.mockResolvedValueOnce(rows).mockResolvedValueOnce([{ count: total }])
}

beforeEach(resetPrismaMock)

describe('toSharedRecord', () => {
  it('renders the timestamps as ISO strings, which is what the wire carries', () => {
    expect(toSharedRecord(row())).toMatchObject({
      createdAt: '2026-01-05T09:14:00.000Z',
      updatedAt: '2026-02-11T16:30:00.000Z',
    })
  })

  it('reads a JSON null column as an empty record rather than passing null on', () => {
    expect(toSharedRecord(row({ data: null })).data).toEqual({})
  })

  it('keeps the stored data otherwise', () => {
    expect(toSharedRecord(row()).data).toEqual({ company: 'Acme' })
  })
})

describe('listRecords', () => {
  it('pages from the first row on page 1', async () => {
    stubPage([row()], 1)

    await listRecords(TABLE_ID, fields, query())

    const values = prismaMock.$queryRaw.mock.calls[0] ?? []
    expect(values).toContain(50)
    expect(values).toContain(0)
  })

  it('offsets by whole pages, so page 3 skips the first two', async () => {
    stubPage([], 0)

    await listRecords(TABLE_ID, fields, query({ page: 3, pageSize: 20 }))

    expect(prismaMock.$queryRaw.mock.calls[0]).toContain(40)
  })

  it('reports the page it was asked for alongside the rows', async () => {
    stubPage([row()], 7)

    const page = await listRecords(TABLE_ID, fields, query({ page: 2, pageSize: 20 }))

    expect(page).toMatchObject({ total: 7, page: 2, pageSize: 20 })
    expect(page.records).toHaveLength(1)
  })

  it('counts zero when the count query comes back empty', async () => {
    // Belt and braces around a `COUNT(*)` that cannot really return no row — but the fallback
    // is what keeps `total` a number rather than `undefined` reaching the client
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await expect(listRecords(TABLE_ID, fields, query())).resolves.toMatchObject({ total: 0 })
  })

  it('runs the rows and the count in one transaction, so both see the same table', async () => {
    stubPage([], 0)

    await listRecords(TABLE_ID, fields, query())

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('resolves relation refs for the ids on this page alone', async () => {
    stubPage([row({ data: { owner: 'rec_9' } })], 1)
    prismaMock.record.findMany.mockResolvedValue([{ id: 'rec_9', number: 3, data: {} }])

    const page = await listRecords(TABLE_ID, [relationField()], query())

    expect(page.relationRefs).toEqual({ fld_owner: { rec_9: { number: 3, label: null } } })
  })
})

describe('getRecordDetail', () => {
  it('scopes the lookup to the table the caller proved it owns', async () => {
    prismaMock.record.findUnique.mockResolvedValue(row())

    await getRecordDetail(table, fields, RECORD_ID)

    expect(prismaMock.record.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RECORD_ID, tableId: TABLE_ID } }),
    )
  })

  it('carries the table and its fields, so the dialog can render away from its own page', async () => {
    prismaMock.record.findUnique.mockResolvedValue(row())

    const detail = await getRecordDetail(table, fields, RECORD_ID)

    expect(detail.table).toEqual(table)
    expect(detail.fields).toEqual(fields)
    expect(detail.record.id).toBe(RECORD_ID)
  })

  it('404s for a record deleted since the link was rendered', async () => {
    prismaMock.record.findUnique.mockResolvedValue(null)

    await expect(getRecordDetail(table, fields, RECORD_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Record not found',
    })
  })
})

describe('createRecord', () => {
  it('takes the number from the table counter and inserts under it, in one transaction', async () => {
    prismaMock.table.update.mockResolvedValue({ recordCounter: 12 })
    prismaMock.record.create.mockResolvedValue(row({ number: 12 }))

    await createRecord(TABLE_ID, fields, { company: 'Acme' })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.table.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { recordCounter: { increment: 1 } } }),
    )
    expect(prismaMock.record.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ number: 12 }) }),
    )
  })

  it('maps a failed insert onto an HTTP error rather than leaking the Prisma one', async () => {
    prismaMock.table.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(createRecord(TABLE_ID, fields, {})).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Record not found',
    })
  })

  it('checks the linked records before it allocates anything', async () => {
    prismaMock.record.findMany.mockResolvedValue([])

    await expect(
      createRecord(TABLE_ID, [relationField()], { owner: 'rec_forged' }),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.table.update).not.toHaveBeenCalled()
  })
})

describe('updateRecord', () => {
  it('replaces the data wholesale, scoped to the table', async () => {
    prismaMock.record.update.mockResolvedValue(row())

    await updateRecord(TABLE_ID, fields, RECORD_ID, { company: 'Beta' })

    expect(prismaMock.record.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RECORD_ID, tableId: TABLE_ID },
        data: { data: { company: 'Beta' } },
      }),
    )
  })

  it('checks the linked records first here too', async () => {
    prismaMock.record.findMany.mockResolvedValue([])

    await expect(
      updateRecord(TABLE_ID, [relationField()], RECORD_ID, { owner: 'rec_forged' }),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(prismaMock.record.update).not.toHaveBeenCalled()
  })

  it('maps a missing row onto a 404', async () => {
    prismaMock.record.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(updateRecord(TABLE_ID, fields, RECORD_ID, {})).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Record not found',
    })
  })
})

describe('deleteRecord', () => {
  it('scopes the delete to the table, so a record id alone is not enough', async () => {
    prismaMock.record.delete.mockResolvedValue(row())

    await deleteRecord(TABLE_ID, RECORD_ID)

    expect(prismaMock.record.delete).toHaveBeenCalledWith({
      where: { id: RECORD_ID, tableId: TABLE_ID },
    })
  })

  it('maps a missing row onto a 404', async () => {
    prismaMock.record.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(deleteRecord(TABLE_ID, RECORD_ID)).rejects.toMatchObject({ statusCode: 404 })
  })
})
