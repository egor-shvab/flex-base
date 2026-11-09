import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useTablesApi } from '~/api/tables'
import type { TLoadStatus } from '~/types/load-status'
import type { ITableListItem } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'
import type { TTableInput } from '#shared/validation/table'

export const useTablesStore = defineStore('tables', () => {
  const api = useTablesApi()

  const tables = shallowRef<ITableListItem[]>([])

  const status = ref<TLoadStatus>('idle')

  async function fetchTables() {
    status.value = 'loading'

    try {
      const response = await api.list()
      tables.value = response.tables
      status.value = 'ready'
    } catch (error) {
      status.value = 'failed'
      throw error
    }
  }

  /**
   * Never throws: the root layout has no error boundary above it, so a rejection would replace
   * every page with Nuxt's full-page error.
   */
  async function ensureTables() {
    if (status.value === 'ready') return

    try {
      await fetchTables()
    } catch {
      // surfaced through `status`
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

  function findTable(tableAddress: string): ITableListItem | undefined {
    const number = parseTableAddress(tableAddress)

    return tables.value.find((table) =>
      number === 0 ? table.id === tableAddress : table.number === number,
    )
  }

  function findTableNumber(tableId: string): number | undefined {
    return tables.value.find((table) => table.id === tableId)?.number
  }

  async function deleteTable(tableAddress: string) {
    await api.remove(tableAddress)

    const removed = findTable(tableAddress)
    tables.value = tables.value.filter((table) => table.id !== removed?.id)
  }

  return {
    tables,
    status,
    fetchTables,
    ensureTables,
    createTable,
    renameTable,
    deleteTable,
    applyTableRow,
    findTable,
    findTableNumber,
  }
})
