import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useFieldsApi } from '~/api/fields'
import { useTablesStore } from '~/stores/tables'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

export const useFieldsStore = defineStore('fields', () => {
  const api = useFieldsApi()
  // A write returns the table's refreshed list row, and the dashboard draws its field count
  // from the list this store holds
  const tables = useTablesStore()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const fields = shallowRef<IField[]>([])

  async function fetchFields(tableId: string) {
    const response = await api.list(tableId)
    fields.value = response.fields
  }

  async function createField(tableId: string, input: TFieldInput) {
    const response = await api.create(tableId, input)
    fields.value = [...fields.value, response.field]
    tables.applyTableRow(response.table)
  }

  async function updateField(tableId: string, fieldId: string, input: TFieldInput) {
    const response = await api.update(tableId, fieldId, input)
    fields.value = fields.value.map((field) => (field.id === fieldId ? response.field : field))
  }

  async function deleteField(tableId: string, fieldId: string) {
    const response = await api.remove(tableId, fieldId)
    fields.value = fields.value.filter((field) => field.id !== fieldId)
    tables.applyTableRow(response.table)
  }

  return { fields, fetchFields, createField, updateField, deleteField }
})
