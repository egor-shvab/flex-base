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
   * `IField`, which carries no table of its own on purpose: `recordColumn()` synthesises fields for
   * `Record #` / `Created at` / `Updated at` that belong to no field row and would have to
   * invent one. `loadOptions` already receives it, so this is the one place that knows.
   */
  const tableAddressByField = ref<Record<string, string>>({})

  /**
   * The same linked records keyed by **number** instead of by id. A filter addresses its target
   * the way a URL does, so the control and the summary behind it both need this direction;
   * everything else in the app holds an id. Maintained here rather than derived at each read,
   * so the two indexes cannot drift.
   */
  const linkedByFieldNumber = ref<Record<string, Record<number, ILinkedRecord>>>({})

  function cacheLinkedRecords(incoming: Record<string, Record<string, ILinkedRecord>>) {
    for (const [fieldId, byRecordId] of Object.entries(incoming)) {
      linkedByField.value[fieldId] = { ...linkedByField.value[fieldId], ...byRecordId }

      const byNumber = { ...linkedByFieldNumber.value[fieldId] }
      for (const linked of Object.values(byRecordId)) byNumber[linked.number] = linked
      linkedByFieldNumber.value[fieldId] = byNumber
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
  async function loadOptions(tableAddress: string, fields: IField[]) {
    const relationFields = fields.filter((field) => field.type === 'RELATION')
    if (relationFields.length === 0) return

    await Promise.all(
      relationFields.map(async (field) => {
        const response = await api.options(tableAddress, field.id)
        tableAddressByField.value[field.id] = tableAddress
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

  /** The same, addressed the way a filter URL addresses it. */
  function linkedRecordByNumber(fieldId: string, number: number): ILinkedRecord | undefined {
    return linkedByFieldNumber.value[fieldId]?.[number]
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
    const tableAddress = tableAddressByField.value[fieldId]
    // Never seeded — nothing has told this store which table answers for the field
    if (tableAddress === undefined) return []

    const response = await api.search(tableAddress, fieldId, term, signal)

    cacheLinkedRecords({ [fieldId]: linkedRecordsFromOptions(response.options) })

    return response.options
  }

  return {
    optionsByField,
    linkedByField,
    linkedByFieldNumber,
    tableAddressByField,
    cacheLinkedRecords,
    loadOptions,
    searchOptions,
    optionsFor,
    linkedRecordFor,
    linkedRecordByNumber,
  }
})
