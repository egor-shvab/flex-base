import type { ITableListItem } from '#shared/types/table'

/** `null` once any table's count is withheld: a sum of the rest would understate the whole. */
export function toRecordTotal(tables: readonly ITableListItem[]): number | null {
  let total = 0

  for (const table of tables) {
    if (table._count.records === null) return null
    total += table._count.records
  }

  return total
}
