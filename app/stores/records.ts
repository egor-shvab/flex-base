import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { useRelationsStore } from '~/stores/relations'
import { DEFAULT_SORT_DIR, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import { RECORD_PAGE_SIZE } from '#shared/constants/record'
import type { IRecord, IRecordPage, IRecordQueryState, TRecordData } from '#shared/types/record'
import { toRecordQueryParams } from '#shared/utils/record-query'

/** Only the unfiltered, unsearched, newest-first view has a predictable place for a new record. */
function isDefaultView(query: IRecordQueryState): boolean {
  return (
    Object.keys(query.filters).length === 0 &&
    query.search === '' &&
    query.sort.key === DEFAULT_SORT_KEY &&
    query.sort.dir === DEFAULT_SORT_DIR
  )
}

export const useRecordsStore = defineStore('records', () => {
  const api = useApi()
  const relations = useRelationsStore()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const records = shallowRef<IRecord[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(RECORD_PAGE_SIZE)
  const pending = ref(false)
  /** Set when the last fetch rejected, so a failed refetch is visible rather than silent. */
  const failed = ref(false)
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
    failed.value = false

    try {
      const response = await api<IRecordPage>(`/api/tables/${tableId}/records`, {
        query: toRecordQueryParams(query),
      })
      records.value = response.records
      total.value = response.total
      page.value = response.page
      pageSize.value = response.pageSize
      loadedTableId.value = tableId
      // Relation cells read their label from there, not from the record's own data
      relations.cacheLabels(response.relationLabels)
    } catch (error) {
      // A refetch runs from a watcher, where a rejection would be unhandled and the table
      // would silently keep showing rows that no longer match the URL. Surfacing it is the
      // page's job; the initial load still throws, so `useAsyncData` can produce the 404.
      failed.value = true
      throw error
    } finally {
      pending.value = false
    }
  }

  /**
   * Records are ordered newest first, so a new one sits at the top of the first page —
   * unless a filter or a custom sort is active, where it may not belong to the current view.
   * Returns the page the new record is on: the URL is the source of truth, so when that
   * differs from the current one the caller navigates and its watcher does the refetch.
   */
  async function createRecord(
    tableId: string,
    data: TRecordData,
    query: IRecordQueryState,
  ): Promise<number> {
    await api<{ record: IRecord }>(`/api/tables/${tableId}/records`, { method: 'POST', body: data })

    const nextPage = isDefaultView(query) ? 1 : query.page
    if (nextPage === query.page) await fetchRecords(tableId, query)

    return nextPage
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
    failed,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  }
})
