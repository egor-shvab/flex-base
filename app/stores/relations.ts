import { ref, shallowRef, triggerRef } from 'vue'
import { defineStore } from 'pinia'
import { useRelationsApi } from '~/api/relations'
import type { TLoadStatus } from '~/types/load-status'
import type { ILinkedRecord, IRecordOption } from '#shared/types/record'

interface IOptionSource {
  workspaceAddress: string
  tableAddress: string
}

export const useRelationsStore = defineStore('relations', () => {
  const api = useRelationsApi()

  // Shallow and mutated in place, then triggered: a deep ref would proxy every cached record, and
  // copying a field's whole map per merge costs as much as the map
  const optionsByField = shallowRef<Record<string, IRecordOption[]>>({})
  const optionStatusByField = shallowRef<Record<string, TLoadStatus>>({})
  const linkedByField = shallowRef<Record<string, Record<string, ILinkedRecord>>>({})
  const linkedByFieldNumber = shallowRef<Record<string, Record<number, ILinkedRecord>>>({})

  /** The table whose page is open: its fields' options and searches are asked of it. */
  const optionSource = ref<IOptionSource | null>(null)

  function cacheLinkedRecords(incoming: Record<string, Record<string, ILinkedRecord>>) {
    for (const [fieldId, byRecordId] of Object.entries(incoming)) {
      const byId = (linkedByField.value[fieldId] ??= {})
      const byNumber = (linkedByFieldNumber.value[fieldId] ??= {})

      for (const [recordId, linked] of Object.entries(byRecordId)) {
        byId[recordId] = linked
        byNumber[linked.number] = linked
      }
    }

    triggerRef(linkedByField)
    triggerRef(linkedByFieldNumber)
  }

  function toLinkedRecords(options: IRecordOption[]): Record<string, ILinkedRecord> {
    return Object.fromEntries(
      options.map((option) => [option.id, { number: option.number, label: option.label }]),
    )
  }

  function setOptionSource(workspaceAddress: string, tableAddress: string) {
    optionSource.value = { workspaceAddress, tableAddress }
  }

  function setOptionStatus(fieldId: string, status: TLoadStatus) {
    optionStatusByField.value = { ...optionStatusByField.value, [fieldId]: status }
  }

  /**
   * Called by the picker when it mounts, so a table that is only browsed asks for no options. A
   * failed load is tried again by the next picker; the picker can still search meanwhile.
   */
  async function ensureOptions(fieldId: string) {
    const source = optionSource.value
    const status = optionStatusByField.value[fieldId]
    if (source === null || status === 'loading' || status === 'ready') return

    setOptionStatus(fieldId, 'loading')

    try {
      const response = await api.options(source.workspaceAddress, source.tableAddress, fieldId)
      optionsByField.value = { ...optionsByField.value, [fieldId]: response.options }
      cacheLinkedRecords({ [fieldId]: toLinkedRecords(response.options) })
      setOptionStatus(fieldId, 'ready')
    } catch {
      setOptionStatus(fieldId, 'failed')
    }
  }

  function optionsFor(fieldId: string): IRecordOption[] {
    return optionsByField.value[fieldId] ?? []
  }

  function findOptionStatus(fieldId: string): TLoadStatus {
    return optionStatusByField.value[fieldId] ?? 'idle'
  }

  function findLinkedRecord(fieldId: string, recordId: string): ILinkedRecord | undefined {
    return linkedByField.value[fieldId]?.[recordId]
  }

  function findLinkedRecordByNumber(fieldId: string, number: number): ILinkedRecord | undefined {
    return linkedByFieldNumber.value[fieldId]?.[number]
  }

  async function searchOptions(
    fieldId: string,
    term: string,
    signal: AbortSignal,
  ): Promise<IRecordOption[]> {
    const source = optionSource.value
    if (source === null) return []

    const response = await api.search(
      source.workspaceAddress,
      source.tableAddress,
      fieldId,
      term,
      signal,
    )

    cacheLinkedRecords({ [fieldId]: toLinkedRecords(response.options) })

    return response.options
  }

  /** On a table switch: field ids are per table, so nothing cached for the last one is read again. */
  function clearState() {
    optionsByField.value = {}
    optionStatusByField.value = {}
    linkedByField.value = {}
    linkedByFieldNumber.value = {}
  }

  return {
    optionsByField,
    optionStatusByField,
    linkedByField,
    linkedByFieldNumber,
    optionSource,
    cacheLinkedRecords,
    setOptionSource,
    ensureOptions,
    searchOptions,
    optionsFor,
    findOptionStatus,
    findLinkedRecord,
    findLinkedRecordByNumber,
    clearState,
  }
})
