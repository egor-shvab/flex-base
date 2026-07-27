import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { DEFAULT_SORT_KEY } from '#shared/constants/filter'
import { RECORD_PAGE_SIZE } from '#shared/constants/record'
import type { IRecord, IRecordPage, IRecordQueryState, TRecordData } from '#shared/types/record'
import { toRecordQueryParams } from '#shared/utils/record-query'

/** Only the unfiltered, oldest-first view has a predictable place for a new record. */
function isDefaultView(query: IRecordQueryState): boolean {
  return (
    Object.keys(query.filters).length === 0 &&
    query.sort.key === DEFAULT_SORT_KEY &&
    query.sort.dir === 'asc'
  )
}

export const useRecordsStore = defineStore('records', () => {
  const api = useApi()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const records = shallowRef<IRecord[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(RECORD_PAGE_SIZE)
  const pending = ref(false)
  // The store is a singleton reused across tables — state must not leak between them
  const loadedTableId = ref('')

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  /**
   * The caller owns the query — it lives in the page URL, so the store never mirrors it.
   * A mirrored copy would have to survive SSR hydration to stay correct.
   */
  async function fetchRecords(tableId: string, query: IRecordQueryState) {
    if (tableId !== loadedTableId.value) clearState()
    pending.value = true

    try {
      const response = await api<IRecordPage>(`/api/tables/${tableId}/records`, {
        query: toRecordQueryParams(query),
      })
      records.value = response.records
      total.value = response.total
      page.value = response.page
      pageSize.value = response.pageSize
      loadedTableId.value = tableId
    } finally {
      pending.value = false
    }
  }

  /** Records are ordered oldest first, so a new one lands on the last page — unless a
   * filter or a custom sort is active, where it may not belong to the current view. */
  async function createRecord(tableId: string, data: TRecordData, query: IRecordQueryState) {
    await api<{ record: IRecord }>(`/api/tables/${tableId}/records`, { method: 'POST', body: data })
    const lastPage = Math.max(1, Math.ceil((total.value + 1) / pageSize.value))
    const nextPage = isDefaultView(query) ? lastPage : page.value
    await fetchRecords(tableId, { ...query, page: nextPage })
  }

  async function updateRecord(
    tableId: string,
    recordId: string,
    data: TRecordData,
    query: IRecordQueryState,
  ) {
    const response = await api<{ record: IRecord }>(`/api/tables/${tableId}/records/${recordId}`, {
      method: 'PATCH',
      body: data,
    })

    // An edit can move a record out of a filtered or sorted view, so that view is refetched
    if (!isDefaultView(query)) {
      await fetchRecords(tableId, { ...query, page: page.value })
      return
    }

    records.value = records.value.map((record) =>
      record.id === recordId ? response.record : record,
    )
  }

  /** Refetches rather than splicing — under server-side pagination the page shifts. */
  async function deleteRecord(tableId: string, recordId: string, query: IRecordQueryState) {
    await api(`/api/tables/${tableId}/records/${recordId}`, { method: 'DELETE' })
    const lastPage = Math.max(1, Math.ceil(Math.max(0, total.value - 1) / pageSize.value))
    await fetchRecords(tableId, { ...query, page: Math.min(page.value, lastPage) })
  }

  function clearState() {
    records.value = []
    total.value = 0
    page.value = 1
    pageSize.value = RECORD_PAGE_SIZE
  }

  return {
    records,
    total,
    page,
    pageSize,
    pageCount,
    pending,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  }
})
