import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useRecordsApi } from '~/api/records'
import { useRelationsStore } from '~/stores/relations'
import { useTablesStore } from '~/stores/tables'
import { DEFAULT_SORT_DIRECTION, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import { RECORD_PAGE_SIZE } from '#shared/constants/record'
import type { IRecord, IRecordQueryState, TRecordData } from '#shared/types/record'

/** Only the unfiltered, unsearched, newest-first view has a predictable place for a new record. */
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
  // A write returns the table's refreshed list row, and the sidebar and the dashboard both draw
  // its record count from the list this store holds
  const tables = useTablesStore()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const records = shallowRef<IRecord[]>([])
  const total = ref(0)
  /** Whether `total` is the cap rather than the count — see `IRecordPage.totalCapped`. */
  const totalCapped = ref(false)
  const page = ref(1)
  const pageSize = ref(RECORD_PAGE_SIZE)
  const pending = ref(false)
  /** Set when the last fetch rejected, so a failed refetch is visible rather than silent. */
  const failed = ref(false)
  // The store is a singleton reused across tables — state must not leak between them
  const loadedTableAddress = ref('')

  /** A lower bound once `totalCapped` is set, which is why nothing gates *paging* on it. */
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  /**
   * Read off the page that came back, not `pageCount`: a capped total makes that a floor, so
   * gating Next on it strands a user at the cap with rows still behind it.
   */
  const hasNextPage = computed(() => records.value.length === pageSize.value)

  /**
   * The caller owns the query — it lives in the page URL, so the store never mirrors it.
   * A mirrored copy would have to survive SSR hydration to stay correct.
   */
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
      // Relation cells read how a link reads from there, not from the record's own data
      relations.cacheLinkedRecords(response.linkedRecords)
    } catch (error) {
      // A refetch runs from a watcher, where a rejection would be unhandled and the table
      // would keep showing rows that no longer match the URL. Surfacing it is the page's job;
      // the initial load still throws, so `useAsyncData` can produce the 404.
      failed.value = true
      throw error
    } finally {
      pending.value = false
    }
  }

  /**
   * Records are newest first, so a new one sits at the top of page 1 — unless a filter or sort
   * is active, where it may not belong to the current view. Returns the page it is on: the URL
   * is the source of truth, so the caller navigates and its watcher does the refetch.
   */
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

    // An edit can move a record out of a filtered or sorted view, so that view is refetched
    if (!isDefaultView(query)) {
      await fetchRecords(tableAddress, { ...query, page: page.value })
      return
    }

    records.value = records.value.map((record) =>
      record.id === recordAddress ? response.record : record,
    )
  }

  /** Refetches rather than splicing — under server-side pagination the page shifts. */
  async function deleteRecord(
    tableAddress: string,
    recordAddress: string,
    query: IRecordQueryState,
  ) {
    const removed = await api.remove(tableAddress, recordAddress)
    tables.applyTableRow(removed.table)
    // A capped total is a lower bound, so clamping on it would drag a user back to the cap's
    // page while rows still sit behind it
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
