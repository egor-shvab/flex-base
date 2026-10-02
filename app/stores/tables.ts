import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useTablesApi } from '~/api/tables'
import type { ITableListItem } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'
import type { TTableInput } from '#shared/validation/table'

export const useTablesStore = defineStore('tables', () => {
  const api = useTablesApi()

  const tables = shallowRef<ITableListItem[]>([])

  const loaded = ref(false)

  const failed = ref(false)

  async function fetchTables() {
    const response = await api.list()
    tables.value = response.tables
    loaded.value = true
    failed.value = false
  }

  /**
   * Never throws: the root layout has no error boundary above it, so a rejection would replace
   * every page with Nuxt's full-page error.
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

  async function renameTable(tableAddress: string, input: TTableInput) {
    const response = await api.rename(tableAddress, input)
    tables.value = tables.value.map((table) =>
      table.id === response.table.id ? response.table : table,
    )
  }

  function applyTableRow(row: ITableListItem) {
    tables.value = tables.value.map((table) => (table.id === row.id ? row : table))
  }

  function tableRow(tableAddress: string): ITableListItem | undefined {
    const number = parseTableAddress(tableAddress)

    return tables.value.find((table) =>
      number === 0 ? table.id === tableAddress : table.number === number,
    )
  }

  function tableNumber(tableId: string): number | undefined {
    return tables.value.find((table) => table.id === tableId)?.number
  }

  async function deleteTable(tableAddress: string) {
    await api.remove(tableAddress)

    const removed = tableRow(tableAddress)
    tables.value = tables.value.filter((table) => table.id !== removed?.id)
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
    tableRow,
    tableNumber,
  }
})
