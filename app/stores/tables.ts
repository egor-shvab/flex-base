import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useTablesApi } from '~/api/tables'
import type { ITableListItem } from '#shared/types/table'
import { parseTableAddress } from '#shared/utils/address'
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
   * The layout's entry point: loads the list once per session and **never throws**. The root
   * layout has no error boundary above it, so a rejection would replace every authenticated
   * page with Nuxt's full-page error instead of a sidebar message.
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
    // Matched on the id the server answered with, not the address asked for
    tables.value = tables.value.map((table) =>
      table.id === response.table.id ? response.table : table,
    )
  }

  /**
   * Replaces one cached row with the one the server answered with. `_count` is read by the
   * sidebar and the dashboard, so every endpoint that moves a count returns the refreshed row.
   *
   * **The count is received, not computed** — a client-side delta is arithmetic over a number
   * only the database knows, and drifts the moment a second tab writes. Rebuilt rather than
   * mutated, because `tables` is a `shallowRef`.
   *
   * A row for a table the list does not hold is ignored: `ensureTables` never throws, so the
   * list may legitimately be empty, and inserting would render a sidebar holding one table.
   */
  function applyTableRow(row: ITableListItem) {
    tables.value = tables.value.map((table) => (table.id === row.id ? row : table))
  }

  /**
   * One cached list row by **address** — what a page holds, having read it off the route. Both
   * forms resolve, so a page reached by an older cuid link still finds its row.
   */
  function tableRow(tableAddress: string): ITableListItem | undefined {
    const number = parseTableAddress(tableAddress)

    return tables.value.find((table) =>
      number === 0 ? table.id === tableAddress : table.number === number,
    )
  }

  /**
   * A table's public number from its id — the direction only a relation needs, since
   * `options.targetTableId` stores an id and a link has to carry an address. Answers for **any**
   * table the user owns, which is why it lives here rather than with the relation's options.
   */
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
