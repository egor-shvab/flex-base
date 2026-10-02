import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, getQuery } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_SORT_DIRECTION, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import { RECORD_PAGE_SIZE } from '#shared/constants/record'
import type { IRecordPage, IRecordQueryState } from '#shared/types/record'
import { useRecordsStore } from '~/stores/records'
import { useRelationsStore } from '~/stores/relations'
import { useTablesStore } from '~/stores/tables'
import { record } from '~~/test/fixtures'

const DEFAULT_QUERY: IRecordQueryState = {
  page: 1,
  sort: { key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION },
  filters: {},
  search: '',
}

const ACME = record({ id: 'rec_1', number: 1, data: { company: 'Acme' } })
const GLOBEX = record({ id: 'rec_2', number: 2, data: { company: 'Globex' } })

let response: IRecordPage
let listShouldFail = false
const requests: { tableId: string; page: string | undefined }[] = []
const writes: string[] = []

function tableRow(counts: { fields: number; records: number }) {
  return {
    id: 'tbl_1',
    name: 'Deals',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: counts,
  }
}

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
      return {
        record: record({ id: 'rec_new', number: 3 }),
        table: tableRow({ fields: 2, records: 8 }),
      }
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

registerEndpoint('/api/tables/tbl_1/records/1', {
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
    return { ok: true, table: tableRow({ fields: 2, records: 6 }) }
  },
})

registerEndpoint('/api/tables', {
  method: 'GET',
  handler: () => ({ tables: [tableRow({ fields: 2, records: 7 })] }),
})

async function loadedTables() {
  const tables = useTablesStore()
  await tables.fetchTables()

  return tables
}

function page(overrides: Partial<IRecordPage> = {}): IRecordPage {
  return {
    records: [ACME, GLOBEX],
    total: 2,
    totalCapped: false,
    page: 1,
    pageSize: RECORD_PAGE_SIZE,
    linkedRecords: {},
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
      expect(store.page).toBe(2)
      expect(store.pageSize).toBe(25)
    })

    it('caches the linked records the page came with', async () => {
      response = page({
        linkedRecords: { fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } } },
      })
      const store = useRecordsStore()

      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      expect(useRelationsStore().linkedRecordFor('fld_owner', 'rec_ada')).toEqual({
        number: 1,
        label: 'Ada Lovelace',
      })
    })

    it('is pending only for the duration of the request', async () => {
      const store = useRecordsStore()

      const settled = store.fetchRecords('tbl_1', DEFAULT_QUERY)
      expect(store.pending).toBe(true)

      await settled
      expect(store.pending).toBe(false)
    })

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

  describe('table scoping', () => {
    it('drops the previous table’s rows before loading another', async () => {
      const store = useRecordsStore()
      response = page({ records: [ACME, GLOBEX], total: 2, page: 3 })
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      listShouldFail = true
      await expect(store.fetchRecords('tbl_2', DEFAULT_QUERY)).rejects.toThrow()

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

  describe('createRecord', () => {
    it('puts a new record on page 1 of the default view', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      const nextPage = await store.createRecord('tbl_1', { company: 'New' }, DEFAULT_QUERY)

      expect(nextPage).toBe(1)
      expect(listCalls()).toBe(1)
    })

    it('sends the caller back to page 1 from deeper in the default view', async () => {
      const store = useRecordsStore()
      const onPage3 = { ...DEFAULT_QUERY, page: 3 }
      await store.fetchRecords('tbl_1', onPage3)
      requests.length = 0

      const nextPage = await store.createRecord('tbl_1', { company: 'New' }, onPage3)

      expect(nextPage).toBe(1)
      expect(listCalls()).toBe(0)
    })

    it.each([
      ['a filter', { filters: { company: 'acme' } }],
      ['a search', { search: 'acme' }],
      ['another sort key', { sort: { key: 'company', direction: DEFAULT_SORT_DIRECTION } }],
      ['the other direction', { sort: { key: DEFAULT_SORT_KEY, direction: 'asc' as const } }],
    ])('stays on the current page under %s', async (_name, narrowing) => {
      const store = useRecordsStore()
      const query = { ...DEFAULT_QUERY, page: 2, ...narrowing }
      await store.fetchRecords('tbl_1', query)
      requests.length = 0

      const nextPage = await store.createRecord('tbl_1', { company: 'New' }, query)

      expect(nextPage).toBe(2)
      expect(listCalls()).toBe(1)
    })

    it('creates before it decides anything', async () => {
      const store = useRecordsStore()

      await store.createRecord('tbl_1', { company: 'New' }, DEFAULT_QUERY)

      expect(writes).toContain('POST tbl_1')
    })

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
      expect(listCalls()).toBe(0)
    })

    it('swaps the row when the record was addressed by its number', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)

      await store.updateRecord('tbl_1', '1', { company: 'Renamed' }, DEFAULT_QUERY)

      expect(store.records[0]?.data.company).toBe('Renamed')
    })

    it('replaces the array rather than mutating it', async () => {
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      const before = store.records

      await store.updateRecord('tbl_1', 'rec_1', { company: 'Renamed' }, DEFAULT_QUERY)

      expect(store.records).not.toBe(before)
    })

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

    it('steps back a page when the last record on it goes', async () => {
      response = page({ total: 26, pageSize: 25, page: 2 })
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

      await store.deleteRecord('tbl_1', 'rec_1', DEFAULT_QUERY)

      expect(requests[0]?.page).toBeUndefined()
    })

    it('never asks for a page below the first', async () => {
      response = page({ total: 1, pageSize: 25, page: 1 })
      const store = useRecordsStore()
      await store.fetchRecords('tbl_1', DEFAULT_QUERY)
      requests.length = 0

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
