import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { ITableListItem } from '#shared/types/table'
import type { TTableInput } from '#shared/validation/table'

export const useTablesStore = defineStore('tables', () => {
  const api = useApi()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const tables = shallowRef<ITableListItem[]>([])

  /** Whether the list has been loaded once. Survives SSR→client via `payload.pinia`. */
  const loaded = ref(false)

  /** Set when `ensureTables` fails, so the sidebar can say so inline. */
  const failed = ref(false)

  async function fetchTables() {
    const response = await api<{ tables: ITableListItem[] }>('/api/tables')
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
    const response = await api<{ table: ITableListItem }>('/api/tables', {
      method: 'POST',
      body: input,
    })
    tables.value = [...tables.value, response.table]
    return response.table
  }

  async function renameTable(tableId: string, input: TTableInput) {
    const response = await api<{ table: ITableListItem }>(`/api/tables/${tableId}`, {
      method: 'PATCH',
      body: input,
    })
    tables.value = tables.value.map((table) => (table.id === tableId ? response.table : table))
  }

  async function deleteTable(tableId: string) {
    await api(`/api/tables/${tableId}`, { method: 'DELETE' })
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
  }
})
