import { beforeEach, describe, expect, it } from 'vitest'
import tablesGet from '#server/api/tables/index.get'
import tablesPost from '#server/api/tables/index.post'
import fieldsPost from '#server/api/tables/[tableId]/fields/index.post'
import fieldDelete from '#server/api/tables/[tableId]/fields/[fieldId].delete'
import recordsPost from '#server/api/tables/[tableId]/records/index.post'
import recordDelete from '#server/api/tables/[tableId]/records/[recordId].delete'
import type { IAuthUser } from '#shared/types/auth'
import { testEvent } from '~~/test/integration/event'
import { createTable, createUser } from '~~/test/integration/seed'

/**
 * The one endpoint the merged coverage report caught at 0% — creating a table, which every
 * other spec reaches through the seed helpers instead. `tables.integration.spec.ts` in
 * `services/` proves the same constraints one layer down; what is only true here is that they
 * arrive as HTTP statuses, and that the row lands under the caller rather than anyone else.
 */
let ada: IAuthUser
let mallory: IAuthUser

const create = (user: IAuthUser | null, body: unknown) =>
  tablesPost(testEvent({ user, method: 'POST', body }))

beforeEach(async () => {
  ada = await createUser()
  mallory = await createUser()
})

describe('creating a table', () => {
  it('hands back the table it created', async () => {
    const { table } = await create(ada, { name: 'Deals' })

    expect(table).toMatchObject({ name: 'Deals' })
    expect(table.id).toBeTruthy()
  })

  /** The ownership rule, at the one endpoint that decides an owner rather than checking one. */
  it('files it under the caller, where only they can see it', async () => {
    await create(ada, { name: 'Deals' })

    await expect(tablesGet(testEvent({ user: ada }))).resolves.toMatchObject({
      tables: [expect.objectContaining({ name: 'Deals' })],
    })
    await expect(tablesGet(testEvent({ user: mallory }))).resolves.toEqual({ tables: [] })
  })

  it('starts it with no records counted', async () => {
    await create(ada, { name: 'Deals' })

    const { tables } = await tablesGet(testEvent({ user: ada }))

    expect(tables[0]?._count).toMatchObject({ fields: 0, records: 0 })
  })

  describe('what it refuses', () => {
    it('400s on a blank name', async () => {
      await expect(create(ada, { name: '' })).rejects.toMatchObject({ statusCode: 400 })
    })

    it('400s on a name past the limit', async () => {
      await expect(create(ada, { name: 'x'.repeat(101) })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('400s when the body carries no name at all', async () => {
      await expect(create(ada, {})).rejects.toMatchObject({ statusCode: 400 })
    })

    /** A uniqueness conflict is a 409, not the 500 an unmapped Prisma error would give. */
    it('409s on a name this user already has, creating nothing', async () => {
      await createTable(ada.id, 'Deals')

      await expect(create(ada, { name: 'Deals' })).rejects.toMatchObject({ statusCode: 409 })

      const { tables } = await tablesGet(testEvent({ user: ada }))
      expect(tables).toHaveLength(1)
    })

    /** Names are unique per user, so someone else holding it is no obstacle. */
    it('allows a name another user has taken', async () => {
      await createTable(mallory.id, 'Deals')

      await expect(create(ada, { name: 'Deals' })).resolves.toMatchObject({
        table: { name: 'Deals' },
      })
    })
  })
})

/**
 * The counts the sidebar and the dashboard draw are **received, not computed**: each write that
 * moves one answers with the table's refreshed list row, and the client stores what it was told.
 * That only holds if the number is read after the write lands, which is a database question —
 * a stub would happily return whatever it was handed.
 *
 * These also drive the four write handlers on their **happy** path. `ownership.integration.spec.ts`
 * runs every endpoint as a stranger and anonymously, but its owner pass is read-only, so until
 * now nothing exercised what these four actually return.
 */
describe('a write answers with the counts it caused', () => {
  let tableId: string

  const params = () => ({ tableId })

  beforeEach(async () => {
    const table = await createTable(ada.id, 'Deals')
    tableId = table.id
  })

  it('counts the field it just created, and stops counting a deleted one', async () => {
    const created = await fieldsPost(
      testEvent({
        user: ada,
        params: params(),
        method: 'POST',
        body: { name: 'Company', type: 'TEXT' },
      }),
    )

    expect(created.table._count).toMatchObject({ fields: 1, records: 0 })

    const removed = await fieldDelete(
      testEvent({
        user: ada,
        params: { tableId, fieldId: created.field.id },
        method: 'DELETE',
      }),
    )

    expect(removed.table._count).toMatchObject({ fields: 0, records: 0 })
  })

  it('counts the record it just created, and stops counting a deleted one', async () => {
    await fieldsPost(
      testEvent({
        user: ada,
        params: params(),
        method: 'POST',
        body: { name: 'Company', type: 'TEXT' },
      }),
    )

    const created = await recordsPost(
      testEvent({ user: ada, params: params(), method: 'POST', body: { company: 'Acme' } }),
    )

    // The count is read after the insert's own transaction, so it includes the row just written
    expect(created.table._count).toMatchObject({ fields: 1, records: 1 })

    const removed = await recordDelete(
      testEvent({
        user: ada,
        params: { tableId, recordId: created.record.id },
        method: 'DELETE',
      }),
    )

    expect(removed.table._count).toMatchObject({ fields: 1, records: 0 })
  })

  /** The row is the whole list row, so the surfaces reading it need nothing else. */
  it('answers with the table itself, not only its counts', async () => {
    const created = await fieldsPost(
      testEvent({
        user: ada,
        params: params(),
        method: 'POST',
        body: { name: 'Company', type: 'TEXT' },
      }),
    )

    expect(created.table).toMatchObject({ id: tableId, name: 'Deals' })
    expect(typeof created.table.createdAt).toBe('string')
  })
})
