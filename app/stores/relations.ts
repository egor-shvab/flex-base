import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useRelationsApi } from '~/api/relations'
import type { IField } from '#shared/types/field'
import type { ILinkedRecord, IRecordOption } from '#shared/types/record'

/**
 * Everything a relation needs in order to read as something other than an id, keyed by the
 * relation field throughout — two fields may point at one table through different label
 * fields, so a field is the only key under which both halves are unambiguous.
 *
 * Linked records arrive from two places that never disagree, because the server builds both
 * from the same rule: the candidates a picker offers, and the ones a page of records came with.
 *
 * **Merge-only, and never cleared between tables** — unlike the records store, which drops its
 * state when the table changes. Keying by field is what rules a per-table clear out: the detail
 * dialog drills across tables and caches fields the current page is not about
 * (`docs/decisions.md`).
 */
export const useRelationsStore = defineStore('relations', () => {
  const api = useRelationsApi()

  const optionsByField = ref<Record<string, IRecordOption[]>>({})
  const linkedByField = ref<Record<string, Record<string, ILinkedRecord>>>({})

  /**
   * Which table's endpoint answers for a relation field. Remembered here rather than added to
   * `IField`, which carries no `tableId` on purpose: `recordColumn()` synthesises fields for
   * `Record #` / `Created at` / `Updated at` that belong to no field row and would have to
   * invent one. `loadOptions` already receives it, so this is the one place that knows.
   */
  const tableIdByField = ref<Record<string, string>>({})

  function cacheLinkedRecords(incoming: Record<string, Record<string, ILinkedRecord>>) {
    for (const [fieldId, byRecordId] of Object.entries(incoming)) {
      linkedByField.value[fieldId] = { ...linkedByField.value[fieldId], ...byRecordId }
    }
  }

  /** An option already carries everything a linked record does; the id is the key it is filed under. */
  function linkedRecordsFromOptions(options: IRecordOption[]): Record<string, ILinkedRecord> {
    return Object.fromEntries(
      options.map((option) => [option.id, { number: option.number, label: option.label }]),
    )
  }

  /**
   * Loads the candidates for every relation field of a table at once. Called with the table's
   * field metadata, so a table without relations makes no request at all.
   */
  async function loadOptions(tableId: string, fields: IField[]) {
    const relationFields = fields.filter((field) => field.type === 'RELATION')
    if (relationFields.length === 0) return

    await Promise.all(
      relationFields.map(async (field) => {
        const response = await api.options(tableId, field.id)
        tableIdByField.value[field.id] = tableId
        optionsByField.value[field.id] = response.options
        cacheLinkedRecords({ [field.id]: linkedRecordsFromOptions(response.options) })
      }),
    )
  }

  function optionsFor(fieldId: string): IRecordOption[] {
    return optionsByField.value[fieldId] ?? []
  }

  function linkedRecordFor(fieldId: string, recordId: string): ILinkedRecord | undefined {
    return linkedByField.value[fieldId]?.[recordId]
  }

  /**
   * The candidates matching a typed term, straight from the server — how a picker reaches a
   * record beyond the capped seed list.
   *
   * It deliberately does **not** write `optionsByField`: that is the seed every other
   * consumer of `optionsFor()` reads, and a search result would clobber it. It does cache
   * the linked records, so one found only through a search still reads as itself in a cell
   * afterwards without a second round trip.
   */
  async function searchOptions(
    fieldId: string,
    term: string,
    signal: AbortSignal,
  ): Promise<IRecordOption[]> {
    const tableId = tableIdByField.value[fieldId]
    // Never seeded — nothing has told this store which table answers for the field
    if (tableId === undefined) return []

    const response = await api.search(tableId, fieldId, term, signal)

    cacheLinkedRecords({ [fieldId]: linkedRecordsFromOptions(response.options) })

    return response.options
  }

  return {
    optionsByField,
    linkedByField,
    tableIdByField,
    cacheLinkedRecords,
    loadOptions,
    searchOptions,
    optionsFor,
    linkedRecordFor,
  }
})
