import type { ITableListItem } from '#shared/types/table'
import type { TTableInput } from '#shared/validation/table'

export const useTablesStore = defineStore('tables', () => {
  const api = useApi()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const tables = shallowRef<ITableListItem[]>([])
  const loaded = ref(false)

  async function fetchTables() {
    const response = await api<{ tables: ITableListItem[] }>('/api/tables')
    tables.value = response.tables
    loaded.value = true
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

  return { tables, loaded, fetchTables, createTable, renameTable, deleteTable }
})
