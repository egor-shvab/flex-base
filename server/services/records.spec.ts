import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { RecordService } from '#server/services/records'
import { DEFAULT_SORT_DIRECTION, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import { RECORD_COUNT_CAP } from '#shared/constants/record'
import type { IRecordQuery } from '#shared/types/record'
import { buildRecordActor, buildTableAccess } from '~~/test/membership'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { relationField, textField } from '~~/test/fixtures'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const TABLE_ID = 'tbl_deals'
const RECORD_ID = 'rec_1'
const ACTOR_ID = 'usr_actor'
const ACTOR = buildRecordActor(ACTOR_ID)
const table = { id: TABLE_ID, number: 1, name: 'Deals' }
const fields = [textField('company')]

function row(overrides: Partial<{ id: string; number: number; data: Prisma.JsonValue }> = {}) {
  return {
    id: RECORD_ID,
    number: 1,
    createdById: ACTOR_ID,
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
    sort: { key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION },
    filters: {},
    search: '',
    ...overrides,
  }
}

function stubPage(rows: unknown[], total: number) {
  prismaMock.$queryRaw.mockResolvedValueOnce(rows).mockResolvedValueOnce([{ count: total }])
}

/** The merge UPDATE the service sent, as one statement. */
function mergeStatement(): Prisma.Sql {
  const call = prismaMock.$queryRaw.mock.calls.find(([sql]) =>
    (sql as Prisma.Sql).text?.includes('UPDATE "Record"'),
  )
  return call?.[0] as Prisma.Sql
}

/** A merge that found no row: the record, the scope or the version missed. */
function stubMergeMiss() {
  prismaMock.$queryRaw.mockResolvedValue([])
}

beforeEach(resetPrismaMock)

describe('RecordService.listRecords', () => {
  it('pages from the first row on page 1', async () => {
    stubPage([row()], 1)

    await RecordService.listRecords(TABLE_ID, fields, query(), ACTOR)

    const values = prismaMock.$queryRaw.mock.calls[0] ?? []
    expect(values).toContain(50)
    expect(values).toContain(0)
  })

  it('offsets by whole pages, so page 3 skips the first two', async () => {
    stubPage([], 0)

    await RecordService.listRecords(TABLE_ID, fields, query({ page: 3, pageSize: 20 }), ACTOR)

    expect(prismaMock.$queryRaw.mock.calls[0]).toContain(40)
  })

  it('reports the page it was asked for alongside the rows', async () => {
    stubPage([row()], 7)

    const page = await RecordService.listRecords(
      TABLE_ID,
      fields,
      query({ page: 2, pageSize: 20 }),
      ACTOR,
    )

    expect(page).toMatchObject({ total: 7, page: 2, pageSize: 20, totalCapped: false })
    expect(page.records).toHaveLength(1)
  })

  it('reports a count at the cap as exact', async () => {
    stubPage([row()], RECORD_COUNT_CAP)

    const page = await RecordService.listRecords(TABLE_ID, fields, query(), ACTOR)

    expect(page).toMatchObject({ total: RECORD_COUNT_CAP, totalCapped: false })
  })

  it('reports one past the cap as capped, and never leaks the extra row into the total', async () => {
    stubPage([row()], RECORD_COUNT_CAP + 1)

    const page = await RecordService.listRecords(TABLE_ID, fields, query(), ACTOR)

    expect(page).toMatchObject({ total: RECORD_COUNT_CAP, totalCapped: true })
  })

  it('bounds the count query itself, so the cap is effort rather than presentation', async () => {
    stubPage([], 0)

    await RecordService.listRecords(TABLE_ID, fields, query(), ACTOR)

    expect(prismaMock.$queryRaw.mock.calls[1]).toContain(RECORD_COUNT_CAP + 1)
  })

  it('counts zero when the count query comes back empty', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await expect(
      RecordService.listRecords(TABLE_ID, fields, query(), ACTOR),
    ).resolves.toMatchObject({
      total: 0,
    })
  })

  it('runs the rows and the count in one transaction, so both see the same table', async () => {
    stubPage([], 0)

    await RecordService.listRecords(TABLE_ID, fields, query(), ACTOR)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('resolves linked records for the ids on this page alone', async () => {
    stubPage([row({ data: { owner: 'rec_9' } })], 1)
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'rec_9', number: 3, label: null }])

    const page = await RecordService.listRecords(TABLE_ID, [relationField()], query(), ACTOR)

    expect(page.linkedRecords).toEqual({ fld_owner: { rec_9: { number: 3, label: null } } })
  })
})

describe('RecordService.getRecordDetail', () => {
  it('scopes the lookup to the table the caller proved it owns', async () => {
    prismaMock.record.findUnique.mockResolvedValue(row())

    await RecordService.getRecordDetail(table, fields, RECORD_ID, ACTOR)

    expect(prismaMock.record.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RECORD_ID, tableId: TABLE_ID } }),
    )
  })

  it('resolves a numeric address through the table’s compound unique', async () => {
    prismaMock.record.findUnique.mockResolvedValue(row())

    await RecordService.getRecordDetail(table, fields, '7', ACTOR)

    expect(prismaMock.record.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tableId_number: { tableId: TABLE_ID, number: 7 } } }),
    )
  })

  it('carries the table and its fields, so the dialog can render away from its own page', async () => {
    prismaMock.record.findUnique.mockResolvedValue(row())

    const detail = await RecordService.getRecordDetail(table, fields, RECORD_ID, ACTOR)

    expect(detail.table).toEqual(table)
    expect(detail.fields).toEqual(fields)
    expect(detail.record.id).toBe(RECORD_ID)
  })

  it('reads both authors as id and name only, in the same query', async () => {
    prismaMock.record.findUnique.mockResolvedValue({
      ...row(),
      createdBy: { id: 'usr_ada', name: 'Ada' },
      updatedBy: null,
    })

    const detail = await RecordService.getRecordDetail(table, fields, RECORD_ID, ACTOR)

    expect(detail.record.createdBy).toEqual({ id: 'usr_ada', name: 'Ada' })
    expect(detail.record.updatedBy).toBeNull()
    expect(prismaMock.record.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
        }),
      }),
    )
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('404s for a record deleted since the link was rendered', async () => {
    prismaMock.record.findUnique.mockResolvedValue(null)

    await expect(
      RecordService.getRecordDetail(table, fields, RECORD_ID, ACTOR),
    ).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Record not found',
    })
  })
})

describe('RecordService.createRecord', () => {
  it('takes the number from the table counter and inserts under it, in one transaction', async () => {
    prismaMock.table.update.mockResolvedValue({ recordCounter: 12 })
    prismaMock.record.create.mockResolvedValue(row({ number: 12 }))

    await RecordService.createRecord(TABLE_ID, fields, { company: 'Acme' }, ACTOR)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { recordCounter: { increment: 1 }, recordCount: { increment: 1 } },
      }),
    )
    expect(prismaMock.record.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ number: 12 }) }),
    )
  })

  it('records the caller as both author and last editor', async () => {
    prismaMock.table.update.mockResolvedValue({ recordCounter: 1 })
    prismaMock.record.create.mockResolvedValue(row())

    await RecordService.createRecord(TABLE_ID, fields, { company: 'Acme' }, ACTOR)

    expect(prismaMock.record.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: ACTOR_ID, updatedById: ACTOR_ID }),
      }),
    )
  })

  it('maps a failed insert onto an HTTP error rather than leaking the Prisma one', async () => {
    prismaMock.table.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(RecordService.createRecord(TABLE_ID, fields, {}, ACTOR)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Record not found',
    })
  })

  it('checks the linked records before it allocates anything', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await expect(
      RecordService.createRecord(TABLE_ID, [relationField()], { owner: 'rec_forged' }, ACTOR),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.table.update).not.toHaveBeenCalled()
  })
})

describe('RecordService.updateRecord', () => {
  it('merges the data over what is stored, scoped to the table, as the caller', async () => {
    prismaMock.$queryRaw.mockResolvedValue([row({ data: { company: 'Beta' } })])

    const record = await RecordService.updateRecord(
      TABLE_ID,
      fields,
      RECORD_ID,
      { company: 'Beta' },
      ACTOR,
    )

    const statement = mergeStatement()
    expect(statement.text).toContain('|| ')
    expect(statement.values).toEqual(
      expect.arrayContaining([TABLE_ID, RECORD_ID, ACTOR_ID, JSON.stringify({ company: 'Beta' })]),
    )
    expect(record.data).toEqual({ company: 'Beta' })
  })

  it('answers with the visible fields only, though the merged row holds every key', async () => {
    prismaMock.$queryRaw.mockResolvedValue([row({ data: { company: 'Beta', salary: 1 } })])

    const record = await RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, ACTOR)

    expect(record.data).toEqual({ company: 'Beta' })
  })

  it('checks the linked records first here too', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await expect(
      RecordService.updateRecord(
        TABLE_ID,
        [relationField()],
        RECORD_ID,
        { owner: 'rec_forged' },
        ACTOR,
      ),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(mergeStatement()).toBeUndefined()
  })

  describe('given the version the caller read', () => {
    const READ = new Date('2026-02-11T16:30:00.000Z')

    it('puts the version in the where, so the check and the write are one statement', async () => {
      prismaMock.$queryRaw.mockResolvedValue([row()])

      await RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, ACTOR, READ)

      expect(mergeStatement().text).toContain('"updatedAt" =')
      expect(mergeStatement().values).toContain(READ.toISOString())
    })

    it('answers 412 when the record is still there under a newer version', async () => {
      stubMergeMiss()
      prismaMock.record.findUnique.mockResolvedValue({ createdById: ACTOR_ID })

      await expect(
        RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, ACTOR, READ),
      ).rejects.toMatchObject({ statusCode: 412 })
    })

    it('still answers 404 when the record is gone', async () => {
      stubMergeMiss()
      prismaMock.record.findUnique.mockResolvedValue(null)

      await expect(
        RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, ACTOR, READ),
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  it('answers 404 for a missing row without a version', async () => {
    stubMergeMiss()
    prismaMock.record.findUnique.mockResolvedValue(null)

    await expect(
      RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, ACTOR),
    ).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Record not found',
    })
  })
})

describe('a record address is a number or a cuid, on every write', () => {
  it('updates by the number when given one', async () => {
    prismaMock.$queryRaw.mockResolvedValue([row()])

    await RecordService.updateRecord(TABLE_ID, fields, '7', { company: 'Beta' }, ACTOR)

    expect(mergeStatement().text).toContain('"number" =')
    expect(mergeStatement().values).toContain(7)
  })

  it('deletes through it too', async () => {
    prismaMock.record.delete.mockResolvedValue(row())

    await RecordService.deleteRecord(TABLE_ID, '7', ACTOR)

    expect(prismaMock.record.delete).toHaveBeenCalledWith({
      where: { tableId_number: { tableId: TABLE_ID, number: 7 } },
    })
  })
})

describe('RecordService.deleteRecord', () => {
  it('scopes the delete to the table, so a record id alone is not enough', async () => {
    prismaMock.record.delete.mockResolvedValue(row())

    await RecordService.deleteRecord(TABLE_ID, RECORD_ID, ACTOR)

    expect(prismaMock.record.delete).toHaveBeenCalledWith({
      where: { id: RECORD_ID, tableId: TABLE_ID },
    })
  })

  it('lowers the table’s record count in the same transaction', async () => {
    prismaMock.record.delete.mockResolvedValue(row())

    await RecordService.deleteRecord(TABLE_ID, RECORD_ID, ACTOR)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TABLE_ID },
        data: { recordCount: { decrement: 1 } },
      }),
    )
  })

  it('maps a missing row onto a 404, leaving the count alone', async () => {
    prismaMock.record.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(RecordService.deleteRecord(TABLE_ID, RECORD_ID, ACTOR)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(prismaMock.table.update).not.toHaveBeenCalled()
  })
})

describe('a role scoped to its own records', () => {
  const OWN_ACTOR = buildRecordActor(
    ACTOR_ID,
    buildTableAccess({ readScope: 'OWN', updateScope: 'OWN', deleteScope: 'OWN' }),
  )
  const READ = new Date('2026-02-11T16:30:00.000Z')
  const gone = () =>
    new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' })

  it('lists and counts only the records the caller created', async () => {
    stubPage([], 0)

    await RecordService.listRecords(TABLE_ID, fields, query(), OWN_ACTOR)

    for (const call of prismaMock.$queryRaw.mock.calls) {
      const [strings, ...values] = call as [TemplateStringsArray, ...Prisma.Sql[]]
      const statement = Prisma.sql(strings, ...values)
      expect(statement.text).toContain('"createdById" =')
      expect(statement.values).toContain(ACTOR_ID)
    }
  })

  it('looks up one record only among the caller’s, so another’s is a 404', async () => {
    prismaMock.record.findUnique.mockResolvedValue(null)

    await expect(
      RecordService.getRecordDetail(table, fields, RECORD_ID, OWN_ACTOR),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.record.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdById: ACTOR_ID, id: RECORD_ID, tableId: TABLE_ID },
      }),
    )
  })

  it('puts the author in the update’s where, beside the version', async () => {
    prismaMock.$queryRaw.mockResolvedValue([row()])

    await RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, OWN_ACTOR, READ)

    expect(mergeStatement().text).toMatch(/"createdById" = .*"updatedAt" =/s)
    expect(mergeStatement().values).toEqual(expect.arrayContaining([ACTOR_ID, READ.toISOString()]))
  })

  it('refuses an edit of a record it reads but did not create with 403, whatever the version', async () => {
    const readAll = { ...OWN_ACTOR, access: { ...OWN_ACTOR.access, readScope: 'ALL' as const } }
    stubMergeMiss()
    prismaMock.record.findUnique.mockResolvedValue({ createdById: 'usr_other' })

    await expect(
      RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, readAll, READ),
    ).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'You can only edit your own records',
    })
  })

  it('still answers 412 for its own record under a newer version', async () => {
    stubMergeMiss()
    prismaMock.record.findUnique.mockResolvedValue({ createdById: ACTOR_ID })

    await expect(
      RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, OWN_ACTOR, READ),
    ).rejects.toMatchObject({ statusCode: 412 })
  })

  it('answers 404 for a record out of its sight, looking only within what it reads', async () => {
    stubMergeMiss()
    prismaMock.record.findUnique.mockResolvedValue(null)

    await expect(
      RecordService.updateRecord(TABLE_ID, fields, RECORD_ID, {}, OWN_ACTOR, READ),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(prismaMock.record.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdById: ACTOR_ID, id: RECORD_ID, tableId: TABLE_ID },
      }),
    )
  })

  it('deletes only its own record, and refuses another it reads with 403', async () => {
    const readAll = { ...OWN_ACTOR, access: { ...OWN_ACTOR.access, readScope: 'ALL' as const } }
    prismaMock.record.delete.mockRejectedValue(gone())
    prismaMock.record.findUnique.mockResolvedValue({ createdById: 'usr_other' })

    await expect(RecordService.deleteRecord(TABLE_ID, RECORD_ID, readAll)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'You can only delete your own records',
    })
    expect(prismaMock.record.delete).toHaveBeenCalledWith({
      where: { createdById: ACTOR_ID, id: RECORD_ID, tableId: TABLE_ID },
    })
    expect(prismaMock.table.update).not.toHaveBeenCalled()
  })
})
