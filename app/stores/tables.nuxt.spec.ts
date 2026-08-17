import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { ITableListItem } from '#shared/types/table'
import { useTablesStore } from '~/stores/tables'

function table(
  id: string,
  name: string,
  counts: ITableListItem['_count'] = { fields: 0, records: 0 },
): ITableListItem {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: counts,
  }
}

/**
 * What the stubbed API is currently prepared to answer with. Reassigned per case rather than
 * re-registering the endpoint, which `registerEndpoint` only does once per URL.
 */
let listing: ITableListItem[] = []
let listShouldFail = false
const calls: string[] = []

registerEndpoint('/api/tables', {
  method: 'GET',
  handler: () => {
    calls.push('GET /api/tables')
    // A 4xx rather than a 500 so the request count stays readable: `ofetch` retries a GET once
    // on 408/409/425/429/5xx, and the store behaves identically either way — it only ever sees
    // the rejection the retries end in.
    if (listShouldFail) throw createError({ statusCode: 404, statusMessage: 'No tables' })
    return { tables: listing }
  },
})

registerEndpoint('/api/tables', {
  method: 'POST',
  handler: () => ({ table: table('tbl_new', 'Invoices') }),
})

registerEndpoint('/api/tables/tbl_1', {
  method: 'PATCH',
  handler: () => ({ table: table('tbl_1', 'Renamed') }),
})

registerEndpoint('/api/tables/tbl_1', {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

describe('useTablesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listing = [table('tbl_1', 'Deals'), table('tbl_2', 'People')]
    listShouldFail = false
    calls.length = 0
  })

  it('starts empty and unloaded', () => {
    const store = useTablesStore()

    expect(store.tables).toEqual([])
    expect(store.loaded).toBe(false)
    expect(store.failed).toBe(false)
  })

  it('fetches the list and marks itself loaded', async () => {
    const store = useTablesStore()

    await store.fetchTables()

    expect(store.tables).toEqual(listing)
    expect(store.loaded).toBe(true)
    expect(store.failed).toBe(false)
  })

  it('loads once per session and is a no-op afterwards', async () => {
    const store = useTablesStore()

    await store.ensureTables()
    await store.ensureTables()
    await store.ensureTables()

    expect(calls).toHaveLength(1)
  })

  /**
   * The root layout has no error boundary above it, so a rejection here would replace every
   * authenticated page with Nuxt's full-page error instead of an inline sidebar message.
   */
  it('never throws from ensureTables, reporting failure on the store instead', async () => {
    listShouldFail = true
    const store = useTablesStore()

    await expect(store.ensureTables()).resolves.toBeUndefined()

    expect(store.failed).toBe(true)
    expect(store.loaded).toBe(false)
    expect(store.tables).toEqual([])
  })

  it('retries after a failure, since a failed attempt never set loaded', async () => {
    listShouldFail = true
    const store = useTablesStore()
    await store.ensureTables()

    listShouldFail = false
    await store.ensureTables()

    expect(calls).toHaveLength(2)
    expect(store.failed).toBe(false)
    expect(store.tables).toEqual(listing)
  })

  it('lets fetchTables throw, unlike ensureTables', async () => {
    listShouldFail = true
    const store = useTablesStore()

    await expect(store.fetchTables()).rejects.toThrow()
  })

  it('appends a created table by replacing the array, not mutating it', async () => {
    const store = useTablesStore()
    await store.fetchTables()
    const before = store.tables

    const created = await store.createTable({ name: 'Invoices' })

    expect(created).toEqual(table('tbl_new', 'Invoices'))
    expect(store.tables).toHaveLength(3)
    expect(store.tables.at(-1)).toEqual(created)
    // shallowRef: a mutation in place would not re-render the sidebar
    expect(store.tables).not.toBe(before)
  })

  it('swaps the renamed table in place and leaves the rest alone', async () => {
    const store = useTablesStore()
    await store.fetchTables()

    await store.renameTable('tbl_1', { name: 'Renamed' })

    expect(store.tables).toEqual([table('tbl_1', 'Renamed'), table('tbl_2', 'People')])
  })

  it('drops the deleted table from the list', async () => {
    const store = useTablesStore()
    await store.fetchTables()

    await store.deleteTable('tbl_1')

    expect(store.tables).toEqual([table('tbl_2', 'People')])
  })

  /**
   * The cached `_count` is read on two always-visible surfaces, and the writes that move it
   * belong to the records and fields stores. Those endpoints answer with the table's refreshed
   * row, so this stores what it was told — it does no arithmetic of its own, which is what the
   * delta it replaced was doing over a number only the database knows.
   */
  describe('applyTableRow', () => {
    beforeEach(() => {
      listing = [
        table('tbl_1', 'Deals', { fields: 3, records: 7 }),
        table('tbl_2', 'People', { fields: 2, records: 4 }),
      ]
    })

    it('replaces one row and leaves every other one alone', async () => {
      const store = useTablesStore()
      await store.fetchTables()

      store.applyTableRow(table('tbl_1', 'Deals', { fields: 3, records: 8 }))

      expect(store.tables).toEqual([
        table('tbl_1', 'Deals', { fields: 3, records: 8 }),
        table('tbl_2', 'People', { fields: 2, records: 4 }),
      ])
    })

    it('takes the row as given rather than deriving anything from what it held', async () => {
      const store = useTablesStore()
      await store.fetchTables()

      // A row the client could not have arrived at by a delta — both counts moved, and the
      // name changed with them. Whatever the server says is what the sidebar draws.
      store.applyTableRow(table('tbl_2', 'Renamed', { fields: 9, records: 0 }))

      expect(store.tables[1]).toEqual(table('tbl_2', 'Renamed', { fields: 9, records: 0 }))
    })

    it('replaces the array rather than mutating the cached item', async () => {
      const store = useTablesStore()
      await store.fetchTables()
      const before = store.tables

      store.applyTableRow(table('tbl_1', 'Deals', { fields: 3, records: 8 }))

      // shallowRef: an in-place edit would leave the sidebar drawing the old number
      expect(store.tables).not.toBe(before)
      expect(store.tables[0]).not.toBe(before[0])
    })

    it('is a no-op for a table the list does not hold, and never fetches', async () => {
      const store = useTablesStore()
      await store.fetchTables()
      calls.length = 0

      store.applyTableRow(table('tbl_missing', 'Ghost', { fields: 1, records: 1 }))

      expect(store.tables).toEqual(listing)
      expect(calls).toHaveLength(0)
    })

    /**
     * The list not being loaded yet is the ordinary case on a record page reached by URL —
     * `ensureTables` may also have failed, which it does silently. Inserting the row instead
     * would leave the sidebar listing only the table just written to.
     */
    it('is a no-op before the list has loaded', () => {
      const store = useTablesStore()

      store.applyTableRow(table('tbl_1', 'Deals', { fields: 3, records: 8 }))

      expect(store.tables).toEqual([])
    })
  })
})
