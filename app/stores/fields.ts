import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useFieldsApi } from '~/api/fields'
import { useTablesStore } from '~/stores/tables'
import type { IField } from '#shared/types/field'
import type { TFieldInput } from '#shared/validation/field'

export const useFieldsStore = defineStore('fields', () => {
  const api = useFieldsApi()
  const tables = useTablesStore()

  const fields = shallowRef<IField[]>([])

  async function fetchFields(workspaceAddress: string, tableAddress: string) {
    const response = await api.list(workspaceAddress, tableAddress)
    fields.value = response.fields
  }

  async function createField(workspaceAddress: string, tableAddress: string, input: TFieldInput) {
    const response = await api.create(workspaceAddress, tableAddress, input)
    fields.value = [...fields.value, response.field]
    tables.applyTableRow(response.table)
  }

  async function updateField(
    workspaceAddress: string,
    tableAddress: string,
    fieldId: string,
    input: TFieldInput,
  ) {
    const response = await api.update(workspaceAddress, tableAddress, fieldId, input)
    fields.value = fields.value.map((field) => (field.id === fieldId ? response.field : field))
  }

  async function deleteField(workspaceAddress: string, tableAddress: string, fieldId: string) {
    const response = await api.remove(workspaceAddress, tableAddress, fieldId)
    fields.value = fields.value.filter((field) => field.id !== fieldId)
    tables.applyTableRow(response.table)
  }

  return { fields, fetchFields, createField, updateField, deleteField }
})
