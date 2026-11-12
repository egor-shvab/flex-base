import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useRecordsApi } from '~/api/records'
import { useRelationsStore } from '~/stores/relations'
import { useTablesStore } from '~/stores/tables'
import type { TLoadStatus } from '~/types/load-status'
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
  const status = ref<TLoadStatus>('idle')
  // Returned although nothing outside reads them: only returned state is hydrated, and a client
  // copy left at '' makes the first refetch after SSR clear the rows
  const loadedWorkspaceAddress = ref('')
  const loadedTableAddress = ref('')

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  const hasNextPage = computed(() => records.value.length === pageSize.value)

  async function fetchRecords(
    workspaceAddress: string,
    tableAddress: string,
    query: IRecordQueryState,
  ) {
    // Table 1 of one workspace is not table 1 of another, so both halves decide
    if (
      workspaceAddress !== loadedWorkspaceAddress.value ||
      tableAddress !== loadedTableAddress.value
    ) {
      clearState()
    }
    status.value = 'loading'

    try {
      const response = await api.list(workspaceAddress, tableAddress, query)
      records.value = response.records
      total.value = response.total
      totalCapped.value = response.totalCapped
      page.value = response.page
      pageSize.value = response.pageSize
      loadedWorkspaceAddress.value = workspaceAddress
      loadedTableAddress.value = tableAddress
      relations.cacheLinkedRecords(response.linkedRecords)
      status.value = 'ready'
    } catch (error) {
      // A refetch runs from a watcher, where a rejection would be unhandled; the initial load still
      // throws, so `useAsyncData` can produce the 404
      status.value = 'failed'
      throw error
    }
  }

  async function createRecord(
    workspaceAddress: string,
    tableAddress: string,
    data: TRecordData,
    query: IRecordQueryState,
  ): Promise<number> {
    const created = await api.create(workspaceAddress, tableAddress, data)
    tables.applyTableRow(created.table)

    const nextPage = isDefaultView(query) ? 1 : query.page
    if (nextPage === query.page) await fetchRecords(workspaceAddress, tableAddress, query)

    return nextPage
  }

  async function updateRecord(
    workspaceAddress: string,
    tableAddress: string,
    recordAddress: string,
    data: TRecordData,
    query: IRecordQueryState,
  ) {
    const response = await api.update(workspaceAddress, tableAddress, recordAddress, data)

    if (!isDefaultView(query)) {
      await fetchRecords(workspaceAddress, tableAddress, { ...query, page: page.value })
      return
    }

    // On the id the server answered with: a numeric address would match no row
    records.value = records.value.map((record) =>
      record.id === response.record.id ? response.record : record,
    )
  }

  async function deleteRecord(
    workspaceAddress: string,
    tableAddress: string,
    recordAddress: string,
    query: IRecordQueryState,
  ) {
    const removed = await api.remove(workspaceAddress, tableAddress, recordAddress)
    tables.applyTableRow(removed.table)
    const lastPage = Math.max(1, Math.ceil(Math.max(0, total.value - 1) / pageSize.value))
    const next = totalCapped.value ? page.value : Math.min(page.value, lastPage)
    await fetchRecords(workspaceAddress, tableAddress, { ...query, page: next })
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
    status,
    loadedWorkspaceAddress,
    loadedTableAddress,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  }
})
