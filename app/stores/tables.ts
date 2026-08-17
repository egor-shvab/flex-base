import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useTablesApi } from '~/api/tables'
import type { ITableListItem } from '#shared/types/table'
import type { TTableInput } from '#shared/validation/table'

export const useTablesStore = defineStore('tables', () => {
  const api = useTablesApi()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const tables = shallowRef<ITableListItem[]>([])

  /** Whether the list has been loaded once. Survives SSR→client via `payload.pinia`. */
  const loaded = ref(false)

  /** Set when `ensureTables` fails, so the sidebar can say so inline. */
  const failed = ref(false)

  async function fetchTables() {
    const response = await api.list()
    tables.value = response.tables
    loaded.value = true
    failed.value = false
  }

  /**
   * The layout's entry point: loads the list once per session and **never throws**.
   * The root layout has no error boundary above it, so a rejection here would replace
   * every authenticated page with Nuxt's full-page error instead of a sidebar message.
   */
  async function ensureTables() {
    if (loaded.value) return

    try {
      await fetchTables()
    } catch {
      failed.value = true
    }
  }

  async function createTable(input: TTableInput) {
    const response = await api.create(input)
    tables.value = [...tables.value, response.table]
    return response.table
  }

  async function renameTable(tableId: string, input: TTableInput) {
    const response = await api.rename(tableId, input)
    tables.value = tables.value.map((table) => (table.id === tableId ? response.table : table))
  }

  /**
   * Moves a cached count by `delta`, because the store that writes the thing being counted is
   * not this one. `_count` arrives with the list and is read on two always-visible surfaces —
   * the sidebar and the dashboard — so without this a created record leaves both wrong until
   * the next full fetch, which in a single-page session may never come.
   *
   * A delta rather than a refetch: every write goes through these stores, so the arithmetic is
   * exact and costs no request. Rebuilt rather than mutated, because `tables` is a `shallowRef`
   * and an in-place edit would not be seen. Floored at 0 — a count can only be wrong downward
   * if two tabs disagree, and a negative one would render as nonsense.
   */
  function adjustCachedCount(tableId: string, key: keyof ITableListItem['_count'], delta: number) {
    tables.value = tables.value.map((table) =>
      table.id === tableId
        ? { ...table, _count: { ...table._count, [key]: Math.max(0, table._count[key] + delta) } }
        : table,
    )
  }

  async function deleteTable(tableId: string) {
    await api.remove(tableId)
    tables.value = tables.value.filter((table) => table.id !== tableId)
  }

  return {
    tables,
    loaded,
    failed,
    fetchTables,
    ensureTables,
    createTable,
    renameTable,
    deleteTable,
    adjustCachedCount,
  }
})
