import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

export const useFieldsStore = defineStore('fields', () => {
  const api = useApi()

  // shallowRef: the collection is replaced wholesale, never mutated item-by-item
  const fields = shallowRef<IField[]>([])

  async function fetchFields(tableId: string) {
    const response = await api<{ fields: IField[] }>(`/api/tables/${tableId}/fields`)
    fields.value = response.fields
  }

  async function createField(tableId: string, input: TFieldInput) {
    const response = await api<{ field: IField }>(`/api/tables/${tableId}/fields`, {
      method: 'POST',
      body: input,
    })
    fields.value = [...fields.value, response.field]
  }

  async function updateField(tableId: string, fieldId: string, input: TFieldInput) {
    const response = await api<{ field: IField }>(`/api/tables/${tableId}/fields/${fieldId}`, {
      method: 'PATCH',
      body: input,
    })
    fields.value = fields.value.map((field) => (field.id === fieldId ? response.field : field))
  }

  async function deleteField(tableId: string, fieldId: string) {
    await api(`/api/tables/${tableId}/fields/${fieldId}`, { method: 'DELETE' })
    fields.value = fields.value.filter((field) => field.id !== fieldId)
  }

  return { fields, fetchFields, createField, updateField, deleteField }
})
