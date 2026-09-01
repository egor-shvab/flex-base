import { beforeEach, describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import tableGet from '#server/api/tables/[tableAddress].get'
import tablePatch from '#server/api/tables/[tableAddress].patch'
import tableDelete from '#server/api/tables/[tableAddress].delete'
import fieldsGet from '#server/api/tables/[tableAddress]/fields/index.get'
import fieldsPost from '#server/api/tables/[tableAddress]/fields/index.post'
import fieldPatch from '#server/api/tables/[tableAddress]/fields/[fieldId].patch'
import fieldDelete from '#server/api/tables/[tableAddress]/fields/[fieldId].delete'
import optionsGet from '#server/api/tables/[tableAddress]/fields/[fieldId]/options.get'
import recordsGet from '#server/api/tables/[tableAddress]/records/index.get'
import recordsPost from '#server/api/tables/[tableAddress]/records/index.post'
import recordGet from '#server/api/tables/[tableAddress]/records/[recordAddress].get'
import recordPatch from '#server/api/tables/[tableAddress]/records/[recordAddress].patch'
import recordDelete from '#server/api/tables/[tableAddress]/records/[recordAddress].delete'
import tablesGet from '#server/api/tables/index.get'
import tablesPost from '#server/api/tables/index.post'
import type { IAuthUser } from '#shared/types/auth'
import { testEvent } from '~~/test/integration/event'
import { createField, createRecord, createTable, createUser } from '~~/test/integration/seed'

/**
 * The rule from `CLAUDE.md` §5, proved at the layer that enforces it rather than one below.
 *
 * A resource that exists but belongs to someone else must be **indistinguishable** from one
 * that does not exist: 404, never 403, or the status itself confirms the resource is there.
 * Every endpoint below is driven twice — once by the owner, once by a stranger — against the
 * same real rows, so a handler that reached for the wrong helper would be caught here.
 */

type THandler = (event: H3Event) => unknown

interface IWorld {
  ada: IAuthUser
  mallory: IAuthUser
  tableId: string
  fieldId: string
  relationFieldId: string
  recordId: string
}

let world: IWorld

beforeEach(async () => {
  const ada = await createUser('ada@example.com')
  const mallory = await createUser('mallory@example.com')

  const table = await createTable(ada.id, 'Deals')
  const field = await createField(table.id, { key: 'company', type: 'TEXT', name: 'Company' })

  const people = await createTable(ada.id, 'People')
  await createField(people.id, { key: 'full_name', type: 'TEXT' })
  const relation = await createField(table.id, {
    key: 'owner',
    name: 'Owner',
    type: 'RELATION',
    order: 1,
    options: { targetTableId: people.id, labelFieldKey: 'full_name' },
  })

  const record = await createRecord(table.id, { company: 'Acme' })

  world = {
    ada,
    mallory,
    tableId: table.id,
    fieldId: field.id,
    relationFieldId: relation.id,
    recordId: record.id,
  }
})

/** Every endpoint that takes a table id, with a body good enough to reach the ownership check. */
function scopedEndpoints() {
  const { tableId, fieldId, relationFieldId, recordId } = world
  const tableParams = { tableAddress: tableId }
  const fieldParams = { tableAddress: tableId, fieldId }
  const recordParams = { tableAddress: tableId, recordAddress: recordId }
  const validField = { name: 'Renamed', type: 'TEXT' }

  return [
    { name: 'GET /tables/:id', handler: tableGet, params: tableParams },
    {
      name: 'PATCH /tables/:id',
      handler: tablePatch,
      params: tableParams,
      body: { name: 'Renamed' },
      method: 'PATCH' as const,
    },
    {
      name: 'DELETE /tables/:id',
      handler: tableDelete,
      params: tableParams,
      method: 'DELETE' as const,
    },
    { name: 'GET /fields', handler: fieldsGet, params: tableParams },
    {
      name: 'POST /fields',
      handler: fieldsPost,
      params: tableParams,
      body: validField,
      method: 'POST' as const,
    },
    {
      name: 'PATCH /fields/:id',
      handler: fieldPatch,
      params: fieldParams,
      body: validField,
      method: 'PATCH' as const,
    },
    {
      name: 'DELETE /fields/:id',
      handler: fieldDelete,
      params: fieldParams,
      method: 'DELETE' as const,
    },
    {
      name: 'GET /fields/:id/options',
      handler: optionsGet,
      params: { tableAddress: tableId, fieldId: relationFieldId },
    },
    { name: 'GET /records', handler: recordsGet, params: tableParams },
    {
      name: 'POST /records',
      handler: recordsPost,
      params: tableParams,
      body: { company: 'Beta' },
      method: 'POST' as const,
    },
    { name: 'GET /records/:id', handler: recordGet, params: recordParams },
    {
      name: 'PATCH /records/:id',
      handler: recordPatch,
      params: recordParams,
      body: { company: 'Beta' },
      method: 'PATCH' as const,
    },
    {
      name: 'DELETE /records/:id',
      handler: recordDelete,
      params: recordParams,
      method: 'DELETE' as const,
    },
  ]
}

describe('a stranger gets 404, never 403', () => {
  it('on every endpoint scoped to a table', async () => {
    for (const endpoint of scopedEndpoints()) {
      const event = testEvent({
        user: world.mallory,
        params: endpoint.params,
        body: endpoint.body,
        method: endpoint.method,
      })

      await expect((endpoint.handler as THandler)(event), endpoint.name).rejects.toMatchObject({
        statusCode: 404,
      })
    }
  })

  it('leaves the owner able to reach the same endpoints', async () => {
    // Read-only ones only — the writes are covered individually, and deleting here would
    // pull the rows out from under the rest of the loop
    for (const endpoint of scopedEndpoints().filter((entry) => entry.method === undefined)) {
      const event = testEvent({ user: world.ada, params: endpoint.params })

      await expect((endpoint.handler as THandler)(event), endpoint.name).resolves.toBeDefined()
    }
  })

  it('does not leak the table through a 403 or a differing message', async () => {
    const stranger = testEvent({ user: world.mallory, params: { tableAddress: world.tableId } })
    const missing = testEvent({ user: world.mallory, params: { tableAddress: 'tbl_nonexistent' } })

    const [a, b] = await Promise.all([
      tableGet(stranger).catch((error: unknown) => error),
      tableGet(missing).catch((error: unknown) => error),
    ])

    expect(a).toMatchObject({ statusCode: 404, statusMessage: 'Table not found' })
    expect(b).toMatchObject({ statusCode: 404, statusMessage: 'Table not found' })
  })

  it('changes nothing when a stranger tries to write', async () => {
    const event = testEvent({
      user: world.mallory,
      params: { tableAddress: world.tableId },
      body: { name: 'Pwned' },
      method: 'PATCH',
    })

    await expect(tablePatch(event)).rejects.toMatchObject({ statusCode: 404 })

    const owner = testEvent({ user: world.ada, params: { tableAddress: world.tableId } })
    await expect(tableGet(owner)).resolves.toMatchObject({ table: { name: 'Deals' } })
  })

  it('never lists another user’s tables', async () => {
    const event = testEvent({ user: world.mallory })

    await expect(tablesGet(event)).resolves.toEqual({ tables: [] })
  })
})

describe('an anonymous request is 401 before anything else', () => {
  it('on every endpoint, including ones whose ids do not exist', async () => {
    const endpoints: THandler[] = [
      tablesGet,
      tablesPost,
      tableGet,
      tablePatch,
      tableDelete,
      fieldsGet,
      fieldsPost,
      fieldPatch,
      fieldDelete,
      optionsGet,
      recordsGet,
      recordsPost,
      recordGet,
      recordPatch,
      recordDelete,
    ]

    for (const handler of endpoints) {
      const event = testEvent({
        params: { tableAddress: 'nope', fieldId: 'nope', recordAddress: 'nope' },
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }
  })
})

/**
 * A relation may only point at a table the same user owns. The schema cannot check it — it has
 * no database — so the endpoint layers `requireFieldTarget` on top, and that check is scoped
 * by owner exactly as everything else is.
 */
describe('a relation cannot be pointed across accounts', () => {
  it('404s when the target table belongs to someone else', async () => {
    const theirs = await createTable(world.mallory.id, 'Theirs')
    await createField(theirs.id, { key: 'full_name', type: 'TEXT' })

    const event = testEvent({
      user: world.ada,
      params: { tableAddress: world.tableId },
      method: 'POST',
      body: {
        name: 'Stolen',
        type: 'RELATION',
        targetTableId: theirs.id,
        labelFieldKey: 'full_name',
      },
    })

    await expect(fieldsPost(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('400s when the label field is not one the target table has', async () => {
    const people = await createTable(world.ada.id, 'More People')
    await createField(people.id, { key: 'full_name', type: 'TEXT' })

    const event = testEvent({
      user: world.ada,
      params: { tableAddress: world.tableId },
      method: 'POST',
      body: {
        name: 'Bad label',
        type: 'RELATION',
        targetTableId: people.id,
        labelFieldKey: 'no_such_field',
      },
    })

    await expect(fieldsPost(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field to show for the link',
    })
  })
})

/**
 * A table-scoped route names its table by the public number a URL carries or by the cuid older
 * links use. Both resolve through one owner-scoped query, which is what a stub cannot show —
 * that the compound unique exists, that it is scoped per user, and that the two forms land on
 * the same row.
 */
describe('a table is addressable by its number as well as by its cuid', () => {
  it('answers identically either way', async () => {
    const table = await createTable(world.ada.id, 'Addressed')

    const byCuid = await tableGet(
      testEvent({ user: world.ada, params: { tableAddress: table.id } }),
    )
    const byNumber = await tableGet(
      testEvent({ user: world.ada, params: { tableAddress: String(table.number) } }),
    )

    expect(byNumber).toEqual(byCuid)
    expect(byNumber.table.id).toBe(table.id)
  })

  /**
   * Numbers are guessable where a cuid was not, so this is the case that matters most. Ada owns
   * `1` and `2`, so Mallory's third is a number Ada has no row for — asking for it must be a 404
   * and must never reach across the account.
   */
  it('404s on a number only another account has', async () => {
    await createTable(world.mallory.id, 'One')
    await createTable(world.mallory.id, 'Two')
    const theirs = await createTable(world.mallory.id, 'Three')

    await expect(
      tableGet(testEvent({ user: world.ada, params: { tableAddress: String(theirs.number) } })),
    ).rejects.toMatchObject({ statusCode: 404, statusMessage: 'Table not found' })
  })

  /** The number runs per user, so the same address is two different tables. */
  it('gives each account its own table 1', async () => {
    const hers = await createTable(world.mallory.id, 'Hers')

    const ada = await tableGet(testEvent({ user: world.ada, params: { tableAddress: '1' } }))
    const mallory = await tableGet(
      testEvent({ user: world.mallory, params: { tableAddress: '1' } }),
    )

    expect(ada.table.name).toBe('Deals')
    expect(mallory.table.id).toBe(hers.id)
  })

  /** Fields and records ride the same resolver, so one case each is enough to prove the seam. */
  it('reaches a table’s fields and records by number too', async () => {
    const number = String((await createTable(world.ada.id, 'Numbered')).number)

    await expect(
      fieldsGet(testEvent({ user: world.ada, params: { tableAddress: number } })),
    ).resolves.toMatchObject({ fields: [] })
    await expect(
      recordsGet(testEvent({ user: world.ada, params: { tableAddress: number } })),
    ).resolves.toMatchObject({ records: [], total: 0 })
  })
})
