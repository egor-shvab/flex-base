import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { IField } from '#shared/types/field'
import type { IRecordOption } from '#shared/types/record'

/**
 * Everything a relation needs in order to read as something other than an id, keyed by the
 * relation field throughout — two fields may point at one table through different label
 * fields, so a field is the only key under which both halves are unambiguous.
 *
 * Labels arrive from two places that never disagree, because the server builds both from the
 * same rule: the candidates a picker offers, and the labels a page of records came with.
 */
export const useRelationsStore = defineStore('relations', () => {
  const api = useApi()

  const optionsByField = ref<Record<string, IRecordOption[]>>({})
  const labelsByField = ref<Record<string, Record<string, string>>>({})

  function cacheLabels(labels: Record<string, Record<string, string>>) {
    for (const [fieldId, fieldLabels] of Object.entries(labels)) {
      labelsByField.value[fieldId] = { ...labelsByField.value[fieldId], ...fieldLabels }
    }
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
        const response = await api<{ options: IRecordOption[] }>(
          `/api/tables/${tableId}/fields/${field.id}/options`,
        )
        optionsByField.value[field.id] = response.options
        cacheLabels({
          [field.id]: Object.fromEntries(
            response.options.map((option) => [option.id, option.label]),
          ),
        })
      }),
    )
  }

  function optionsFor(fieldId: string): IRecordOption[] {
    return optionsByField.value[fieldId] ?? []
  }

  function labelFor(fieldId: string, recordId: string): string | undefined {
    return labelsByField.value[fieldId]?.[recordId]
  }

  return { optionsByField, labelsByField, cacheLabels, loadOptions, optionsFor, labelFor }
})
