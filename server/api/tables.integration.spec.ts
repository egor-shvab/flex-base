import { beforeEach, describe, expect, it } from 'vitest'
import tablesGet from '#server/api/tables/index.get'
import tablesPost from '#server/api/tables/index.post'
import fieldsPost from '#server/api/tables/[tableAddress]/fields/index.post'
import fieldDelete from '#server/api/tables/[tableAddress]/fields/[fieldId].delete'
import recordsPost from '#server/api/tables/[tableAddress]/records/index.post'
import recordDelete from '#server/api/tables/[tableAddress]/records/[recordAddress].delete'
import type { IAuthUser } from '#shared/types/auth'
import { testEvent } from '~~/test/integration/event'
import { createTable, createUser } from '~~/test/integration/seed'

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

  it('numbers the caller’s tables from one, in the order they were made', async () => {
    for (const name of ['Deals', 'People', 'Companies']) await create(ada, { name })
    await create(mallory, { name: 'Theirs' })

    const { tables } = await tablesGet(testEvent({ user: ada }))
    const { tables: theirs } = await tablesGet(testEvent({ user: mallory }))

    expect(tables.map((table) => [table.name, table.number])).toEqual([
      ['Deals', 1],
      ['People', 2],
      ['Companies', 3],
    ])
    expect(theirs.map((table) => table.number)).toEqual([1])
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

    it('409s on a name this user already has, creating nothing', async () => {
      await createTable(ada.id, 'Deals')

      await expect(create(ada, { name: 'Deals' })).rejects.toMatchObject({ statusCode: 409 })

      const { tables } = await tablesGet(testEvent({ user: ada }))
      expect(tables).toHaveLength(1)
    })

    it('allows a name another user has taken', async () => {
      await createTable(mallory.id, 'Deals')

      await expect(create(ada, { name: 'Deals' })).resolves.toMatchObject({
        table: { name: 'Deals' },
      })
    })
  })
})

describe('a write answers with the counts it caused', () => {
  let tableId: string

  const params = () => ({ tableAddress: tableId })

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
        params: { tableAddress: tableId, fieldId: created.field.id },
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

    expect(created.table._count).toMatchObject({ fields: 1, records: 1 })

    const removed = await recordDelete(
      testEvent({
        user: ada,
        params: { tableAddress: tableId, recordAddress: created.record.id },
        method: 'DELETE',
      }),
    )

    expect(removed.table._count).toMatchObject({ fields: 1, records: 0 })
  })

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
