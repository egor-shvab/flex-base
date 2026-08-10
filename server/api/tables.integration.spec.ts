import { beforeEach, describe, expect, it } from 'vitest'
import tablesGet from '#server/api/tables/index.get'
import tablesPost from '#server/api/tables/index.post'
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
