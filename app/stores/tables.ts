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
   * Replaces one cached row with the one the server just answered with. `_count` is read on two
   * always-visible surfaces — the sidebar and the dashboard — so a write to a table's fields or
   * records has to reach them, and the endpoints that move a count return the refreshed row for
   * exactly that.
   *
   * **The count is received, not computed.** This replaced a delta the client applied itself,
   * which was arithmetic over a number only the database knows: it needed a floor at zero to
   * stay presentable, and it drifted the moment a second tab wrote. Rebuilt rather than mutated,
   * because `tables` is a `shallowRef` and an in-place edit would not be seen.
   *
   * A row for a table the list does not hold is ignored — `ensureTables` never throws, so the
   * list may legitimately be empty, and inserting one row into an unloaded list would render a
   * sidebar holding only the table just written to.
   */
  function applyTableRow(row: ITableListItem) {
    tables.value = tables.value.map((table) => (table.id === row.id ? row : table))
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
    applyTableRow,
  }
})
