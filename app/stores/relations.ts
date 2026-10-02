import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useRelationsApi } from '~/api/relations'
import type { IField } from '#shared/types/field'
import type { ILinkedRecord, IRecordOption } from '#shared/types/record'

export const useRelationsStore = defineStore('relations', () => {
  const api = useRelationsApi()

  const optionsByField = ref<Record<string, IRecordOption[]>>({})
  const linkedByField = ref<Record<string, Record<string, ILinkedRecord>>>({})

  const tableAddressByField = ref<Record<string, string>>({})

  const linkedByFieldNumber = ref<Record<string, Record<number, ILinkedRecord>>>({})

  function cacheLinkedRecords(incoming: Record<string, Record<string, ILinkedRecord>>) {
    for (const [fieldId, byRecordId] of Object.entries(incoming)) {
      linkedByField.value[fieldId] = { ...linkedByField.value[fieldId], ...byRecordId }

      const byNumber = { ...linkedByFieldNumber.value[fieldId] }
      for (const linked of Object.values(byRecordId)) byNumber[linked.number] = linked
      linkedByFieldNumber.value[fieldId] = byNumber
    }
  }

  function linkedRecordsFromOptions(options: IRecordOption[]): Record<string, ILinkedRecord> {
    return Object.fromEntries(
      options.map((option) => [option.id, { number: option.number, label: option.label }]),
    )
  }

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

  function linkedRecordByNumber(fieldId: string, number: number): ILinkedRecord | undefined {
    return linkedByFieldNumber.value[fieldId]?.[number]
  }

  async function searchOptions(
    fieldId: string,
    term: string,
    signal: AbortSignal,
  ): Promise<IRecordOption[]> {
    const tableAddress = tableAddressByField.value[fieldId]
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
