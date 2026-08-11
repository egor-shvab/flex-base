import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, getQuery } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_SORT_DIR, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import { RECORD_PAGE_SIZE } from '#shared/constants/record'
import type { IRecordPage, IRecordQueryState } from '#shared/types/record'
import { useRecordsStore } from '~/stores/records'
import { useRelationsStore } from '~/stores/relations'
import { useTablesStore } from '~/stores/tables'
import { record } from '~~/test/fixtures'

/** The unfiltered, unsearched, newest-first view — the only one with a place for a new record. */
const DEFAULT_QUERY: IRecordQueryState = {
  page: 1,
  sort: { key: DEFAULT_SORT_KEY, dir: DEFAULT_SORT_DIR },
  filters: {},
  search: '',
}

const ACME = record({ id: 'rec_1', number: 1, data: { company: 'Acme' } })
const GLOBEX = record({ id: 'rec_2', number: 2, data: { company: 'Globex' } })

/** What the list endpoint answers with, and every request it saw. */
let response: IRecordPage
let listShouldFail = false
const requests: { tableId: string; page: string | undefined }[] = []
const writes: string[] = []

for (const tableId of ['tbl_1', 'tbl_2']) {
  registerEndpoint(`/api/tables/${tableId}/records`, {
    method: 'GET',
    handler: (event) => {
      const { page } = getQuery(event)
      requests.push({ tableId, page: typeof page === 'string' ? page : undefined })

      if (listShouldFail) throw createError({ statusCode: 404, statusMessage: 'No such table' })
      return response
    },
  })

  registerEndpoint(`/api/tables/${tableId}/records`, {
    method: 'POST',
    handler: () => {
      writes.push(`POST ${tableId}`)
      return { record: record({ id: 'rec_new', number: 3 }) }
    },
  })
}

registerEndpoint('/api/tables/tbl_1/records/rec_1', {
  method: 'PATCH',
  handler: () => {
    writes.push('PATCH rec_1')
    return { record: record({ id: 'rec_1', number: 1, data: { company: 'Renamed' } }) }
  },
})

registerEndpoint('/api/tables/tbl_1/records/rec_1', {
  method: 'DELETE',
  handler: () => {
    writes.push('DELETE rec_1')
    return { ok: true }
  },
})

/**
 * The tables store's own list, so a write can be seen moving the cached `_count` the sidebar
 * and the dashboard draw. Registered here because `registerEndpoint` is per file.
 */
registerEndpoint('/api/tables', {
  method: 'GET',
  handler: () => ({
    tables: [
      {
        id: 'tbl_1',
        name: 'Deals',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        _count: { fields: 2, records: 7 },
      },
    ],
  }),
})

/** The tables store loaded, so a bump has something to land on. */
async function loadedTables() {
  const tables = useTablesStore()
  await tables.fetchTables()

  return tables
}

function page(overrides: Partial<IRecordPage> = {}): IRecordPage {
  return {
    records: [ACME, GLOBEX],
    total: 2,
    page: 1,
    pageSize: RECORD_PAGE_SIZE,
    relationLabels: {},
    ...overrides,
  }
}

const listCalls = () => requests.length

describe('useRecordsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    response = page()
    listShouldFail = false
    requests.length = 0
    writes.length = 0
  })

  it('starts empty on the first page', () => {
    const store = useRecordsStore()

    expect(store.records).toEqual([])
    expect(store.total).toBe(0)
    expect(store.page).toBe(1)
    expect(store.pageSize).toBe(RECORD_PAGE_SIZE)
    expect(store.pending).toBe(false)
    expect(store.failed).toBe(false)
  })

  describe('fetchRecords', () => {
    it('takes the whole page the server resolved', async () => {
      response = page({ records: [ACME], total: 51, page: 2, pageSize: 25 })
      const store = useRecordsStore()

      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      expect(store.records).toEqual([ACME])
      expect(store.total).toBe(51)
      // The server resolves the page and size it enforced, so the store takes them back
      expect(store.page).toBe(2)
      expect(store.pageSize).toBe(25)
    })

    /** Relation cells read their label from the store, not from the record's own data. */
    it('caches the relation labels the page came with', async () => {
      response = page({ relationLabels: { fld_owner: { rec_ada: 'Ada Lovelace' } } })
      const store = useRecordsStore()

      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      expect(useRelationsStore().labelFor('fld_owner', 'rec_ada')).toBe('Ada Lovelace')
    })

    it('is pending only for the duration of the request', async () => {
      const store = useRecordsStore()

      const settled = store.fetchRecords('tbl_1', DEFAULT_QUERY)
      expect(store.pending).toBe(true)

      await settled
      expect(store.pending).toBe(false)
    })

    /**
     * A refetch runs from a watcher, where swallowing would leave the table showing rows that no
     * longer match the URL — so `failed` is set *and* the rejection propagates, which is what
     * lets the initial load still produce a 404 through `useAsyncData`. The opposite of
     * `ensureTables`, deliberately.
     */
    it('records the failure and still rejects', async () => {
      listShouldFail = true
      const store = useRecordsStore()

      await expect(store.fetchRecords('tbl_1', DEFAULT_QUERY)).rejects.toThrow()

      expect(store.failed).toBe(true)
      expect(store.pending).toBe(false)
    })

    it('clears the failure on the next good fetch', async () => {
      listShouldFail = true
      const store = useRecordsStore()
      await expect(store.fetchRecords('tbl_1', DEFAULT_QUERY)).rejects.toThrow()

      listShouldFail = false
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      expect(store.failed).toBe(false)
    })
  })

  /** The store is a singleton reused across tables — state must not leak between them. */
  describe('table scoping', () => {
    it('drops the previous table’s rows before loading another', async () => {
      const store = useRecordsStore()
      response = page({ records: [ACME, GLOBEX], total: 2, page: 3 })
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      listShouldFail = true
      await expect(store.fetchRecords('tbl_2', DEFAULT_QUERY)).rejects.toThrow()

      // The failed load left nothing, and the previous table's rows did not survive it
      expect(store.records).toEqual([])
      expect(store.total).toBe(0)
      expect(store.page).toBe(1)
    })

    it('keeps what it has when the same table is refetched', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      listShouldFail = true
      await expect(store.fetchRecords('tbl_1', DEFAULT_QUERY)).rejects.toThrow()

      expect(store.records).toEqual([ACME, GLOBEX])
    })
  })

  describe('pageCount', () => {
    it('is one even with nothing to show', () => {
      expect(useRecordsStore().pageCount).toBe(1)
    })

    it('rounds a partial page up', async () => {
      response = page({ total: 51, pageSize: 25 })
      const store = useRecordsStore()

      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      expect(store.pageCount).toBe(3)
    })

    it('is exact when the last page is full', async () => {
      response = page({ total: 50, pageSize: 25 })
      const store = useRecordsStore()

      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      expect(store.pageCount).toBe(2)
    })
  })

  /**
   * Records are newest first, so a new one sits at the top of page 1 — unless a filter or a
   * custom sort is active, where it may not belong to the current view at all. The URL is the
   * source of truth, so a differing page is returned for the caller to navigate to rather than
   * fetched here.
   */
  describe('createRecord', () => {
    it('puts a new record on page 1 of the default view', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      const nextPage = await store.createRecord('tbl_1', { company: 'New' }, DEFAULT_QUERY)

      expect(nextPage).toBe(1)
      // Already on page 1, so the store refetches rather than making the caller navigate
      expect(listCalls()).toBe(1)
    })

    it('sends the caller back to page 1 from deeper in the default view', async () => {
      const store = useRecordsStore()
      const onPage3 = { ...DEFAULT_QUERY, page: 3 }
      await store.fetchRecords('tbl_1', onPage3)
      requests.length = 0

      const nextPage = await store.createRecord('tbl_1', { company: 'New' }, onPage3)

      expect(nextPage).toBe(1)
      // The caller navigates and its watcher does the refetch — doing it here would double it
      expect(listCalls()).toBe(0)
    })

    /**
     * Each clause of the private `isDefaultView` predicate, separately: a half-tested `&&`
     * chain would let a new record be assumed onto page 1 of a view it does not belong to.
     */
    it.each([
      ['a filter', { filters: { company: 'acme' } }],
      ['a search', { search: 'acme' }],
      ['another sort key', { sort: { key: 'company', dir: DEFAULT_SORT_DIR } }],
      ['the other direction', { sort: { key: DEFAULT_SORT_KEY, dir: 'asc' as const } }],
    ])('stays on the current page under %s', async (_name, narrowing) => {
      const store = useRecordsStore()
      const query = { ...DEFAULT_QUERY, page: 2, ...narrowing }
      await store.fetchRecords('tbl_1', query)
      requests.length = 0

      const nextPage = await store.createRecord('tbl_1', { company: 'New' }, query)

      expect(nextPage).toBe(2)
      // Same page, so it is refetched here
      expect(listCalls()).toBe(1)
    })

    it('creates before it decides anything', async () => {
      const store = useRecordsStore()

      await store.createRecord('tbl_1', { company: 'New' }, DEFAULT_QUERY)

      expect(writes).toContain('POST tbl_1')
    })

    /**
     * The cached count is read by the sidebar on every page and by the dashboard, and this
     * store is the only thing that knows it moved — nothing refetches the list to find out.
     */
    it('tells the tables store the record count went up', async () => {
      const tables = await loadedTables()
      const store = useRecordsStore()

      await store.createRecord('tbl_1', { company: 'New' }, DEFAULT_QUERY)

      expect(tables.tables[0]?._count).toEqual({ fields: 2, records: 8 })
    })
  })

  describe('updateRecord', () => {
    it('swaps the record in place in the default view', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      await store.updateRecord('tbl_1', 'rec_1', { company: 'Renamed' }, DEFAULT_QUERY)

      expect(store.records[0]?.data.company).toBe('Renamed')
      expect(store.records[1]).toEqual(GLOBEX)
      // Nothing about the view changed, so there is nothing to refetch
      expect(listCalls()).toBe(0)
    })

    it('replaces the array rather than mutating it', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      const before = store.records

      await store.updateRecord('tbl_1', 'rec_1', { company: 'Renamed' }, DEFAULT_QUERY)

      expect(store.records).not.toBe(before)
    })

    /** An edit can move a record out of a filtered or sorted view, so that view is refetched. */
    it('refetches instead when the view is narrowed', async () => {
      const store = useRecordsStore()
      const query = { ...DEFAULT_QUERY, filters: { company: 'acme' } }
      await store.fetchRecords('tbl_1', query)
      requests.length = 0

      await store.updateRecord('tbl_1', 'rec_1', { company: 'Renamed' }, query)

      expect(listCalls()).toBe(1)
    })

    it('moves no count — an edit changes a record, not how many there are', async () => {
      const tables = await loadedTables()
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      await store.updateRecord('tbl_1', 'rec_1', { company: 'Renamed' }, DEFAULT_QUERY)

      expect(tables.tables[0]?._count).toEqual({ fields: 2, records: 7 })
    })

    it('refetches the page it is actually on, not the one the query names', async () => {
      response = page({ page: 4 })
      const store = useRecordsStore()
      const query = { ...DEFAULT_QUERY, page: 1, search: 'acme' }
      await store.fetchRecords('tbl_1', query)
      requests.length = 0

      await store.updateRecord('tbl_1', 'rec_1', { company: 'Renamed' }, query)

      expect(requests[0]?.page).toBe('4')
    })
  })

  /** Refetches rather than splicing — under server-side pagination the page shifts. */
  describe('deleteRecord', () => {
    it('always refetches', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      await store.deleteRecord('tbl_1', 'rec_1', DEFAULT_QUERY)

      expect(writes).toContain('DELETE rec_1')
      expect(listCalls()).toBe(1)
    })

    it('stays put while the page still has records', async () => {
      response = page({ total: 100, pageSize: 25, page: 2 })
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      await store.deleteRecord('tbl_1', 'rec_1', DEFAULT_QUERY)

      expect(requests[0]?.page).toBe('2')
    })

    /**
     * Deleting the last record on the last page must not land on an empty one. Page 1 is the
     * default, and `toRecordQueryParams` omits defaults to keep an unfiltered view a clean
     * link — so stepping back to it shows up as the param disappearing.
     */
    it('steps back a page when the last record on it goes', async () => {
      response = page({ total: 26, pageSize: 25, page: 2 })
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      await store.deleteRecord('tbl_1', 'rec_1', DEFAULT_QUERY)

      // 25 records left over a page size of 25 is one page, so it asks for the first
      expect(requests[0]?.page).toBeUndefined()
    })

    it('never asks for a page below the first', async () => {
      response = page({ total: 1, pageSize: 25, page: 1 })
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      // `Math.max(1, …)` over a now-empty table, rather than page 0
      await store.deleteRecord('tbl_1', 'rec_1', DEFAULT_QUERY)

      expect(requests[0]?.page).toBeUndefined()
      expect(requests).toHaveLength(1)
    })

    it('tells the tables store the record count went down', async () => {
      const tables = await loadedTables()
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      await store.deleteRecord('tbl_1', 'rec_1', DEFAULT_QUERY)

      expect(tables.tables[0]?._count).toEqual({ fields: 2, records: 6 })
    })
  })
})
