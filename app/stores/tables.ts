import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useTablesApi } from '~/api/tables'
import type { TLoadStatus } from '~/types/load-status'
import type { ITableListItem } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'
import type { TTableInput } from '#shared/validation/table'

/** The tables of one workspace at a time: the one last loaded. */
export const useTablesStore = defineStore('tables', () => {
  const api = useTablesApi()

  const tables = shallowRef<ITableListItem[]>([])

  const status = ref<TLoadStatus>('idle')

  // Returned so it hydrates: a client copy left at '' would refetch what SSR already loaded
  const loadedWorkspaceAddress = ref('')

  /** An answer for a workspace switched away from belongs to a list no longer held. */
  function isLoadedWorkspace(workspaceAddress: string): boolean {
    return workspaceAddress === loadedWorkspaceAddress.value
  }

  async function fetchTables(workspaceAddress: string) {
    // Emptied first, or the sidebar shows the previous workspace's tables until the answer lands
    if (!isLoadedWorkspace(workspaceAddress)) tables.value = []
    loadedWorkspaceAddress.value = workspaceAddress
    status.value = 'loading'

    try {
      const response = await api.list(workspaceAddress)
      if (!isLoadedWorkspace(workspaceAddress)) return
      tables.value = response.tables
      status.value = 'ready'
    } catch (error) {
      if (!isLoadedWorkspace(workspaceAddress)) return
      status.value = 'failed'
      throw error
    }
  }

  /**
   * Never throws: the root layout has no error boundary above it, so a rejection would replace
   * every page with Nuxt's full-page error.
   */
  async function ensureTables(workspaceAddress: string) {
    if (status.value === 'ready' && workspaceAddress === loadedWorkspaceAddress.value) return

    try {
      await fetchTables(workspaceAddress)
    } catch {
      // surfaced through `status`
    }
  }

  async function createTable(workspaceAddress: string, input: TTableInput) {
    const response = await api.create(workspaceAddress, input)
    if (isLoadedWorkspace(workspaceAddress)) tables.value = [...tables.value, response.table]
    return response.table
  }

  async function renameTable(workspaceAddress: string, tableAddress: string, input: TTableInput) {
    const response = await api.rename(workspaceAddress, tableAddress, input)
    if (!isLoadedWorkspace(workspaceAddress)) return
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

  async function deleteTable(workspaceAddress: string, tableAddress: string) {
    await api.remove(workspaceAddress, tableAddress)
    // An address is a number, and the same number names another table in the next workspace
    if (!isLoadedWorkspace(workspaceAddress)) return

    const removed = findTable(tableAddress)
    tables.value = tables.value.filter((table) => table.id !== removed?.id)
  }

  return {
    tables,
    status,
    loadedWorkspaceAddress,
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
