import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useRecordsApi } from '~/api/records'
import { useRelationsStore } from '~/stores/relations'
import { useTablesStore } from '~/stores/tables'
import { DEFAULT_SORT_DIRECTION, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import { RECORD_PAGE_SIZE } from '#shared/constants/record'
import type { IRecord, IRecordQueryState, TRecordData } from '#shared/types/record'

function isDefaultView(query: IRecordQueryState): boolean {
  return (
    Object.keys(query.filters).length === 0 &&
    query.search === '' &&
    query.sort.key === DEFAULT_SORT_KEY &&
    query.sort.direction === DEFAULT_SORT_DIRECTION
  )
}

export const useRecordsStore = defineStore('records', () => {
  const api = useRecordsApi()
  const relations = useRelationsStore()
  const tables = useTablesStore()

  const records = shallowRef<IRecord[]>([])
  const total = ref(0)
  const totalCapped = ref(false)
  const page = ref(1)
  const pageSize = ref(RECORD_PAGE_SIZE)
  const pending = ref(false)
  const failed = ref(false)
  const loadedTableAddress = ref('')

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  const hasNextPage = computed(() => records.value.length === pageSize.value)

  async function fetchRecords(tableAddress: string, query: IRecordQueryState) {
    if (tableAddress !== loadedTableAddress.value) clearState()
    pending.value = true
    failed.value = false

    try {
      const response = await api.list(tableAddress, query)
      records.value = response.records
      total.value = response.total
      totalCapped.value = response.totalCapped
      page.value = response.page
      pageSize.value = response.pageSize
      loadedTableAddress.value = tableAddress
      relations.cacheLinkedRecords(response.linkedRecords)
    } catch (error) {
      // A refetch runs from a watcher, where a rejection would be unhandled; the initial load still
      // throws, so `useAsyncData` can produce the 404
      failed.value = true
      throw error
    } finally {
      pending.value = false
    }
  }

  async function createRecord(
    tableAddress: string,
    data: TRecordData,
    query: IRecordQueryState,
  ): Promise<number> {
    const created = await api.create(tableAddress, data)
    tables.applyTableRow(created.table)

    const nextPage = isDefaultView(query) ? 1 : query.page
    if (nextPage === query.page) await fetchRecords(tableAddress, query)

    return nextPage
  }

  async function updateRecord(
    tableAddress: string,
    recordAddress: string,
    data: TRecordData,
    query: IRecordQueryState,
  ) {
    const response = await api.update(tableAddress, recordAddress, data)

    if (!isDefaultView(query)) {
      await fetchRecords(tableAddress, { ...query, page: page.value })
      return
    }

    // On the id the server answered with: a numeric address would match no row
    records.value = records.value.map((record) =>
      record.id === response.record.id ? response.record : record,
    )
  }

  async function deleteRecord(
    tableAddress: string,
    recordAddress: string,
    query: IRecordQueryState,
  ) {
    const removed = await api.remove(tableAddress, recordAddress)
    tables.applyTableRow(removed.table)
    const lastPage = Math.max(1, Math.ceil(Math.max(0, total.value - 1) / pageSize.value))
    const next = totalCapped.value ? page.value : Math.min(page.value, lastPage)
    await fetchRecords(tableAddress, { ...query, page: next })
  }

  function clearState() {
    records.value = []
    total.value = 0
    totalCapped.value = false
    page.value = 1
    pageSize.value = RECORD_PAGE_SIZE
  }

  return {
    records,
    total,
    totalCapped,
    page,
    pageSize,
    pageCount,
    hasNextPage,
    pending,
    failed,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  }
})
