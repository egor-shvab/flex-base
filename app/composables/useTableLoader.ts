import { useTablesApi } from '~/api/tables'
import { useFieldsStore } from '~/stores/fields'
import type { ITable } from '#shared/types/table'

/**
 * Loads a table and its fields together. Owns neither the `useAsyncData` nor the error: each page
 * must key its own call, and a shared key is a known bug.
 */
export function useTableLoader() {
  const api = useTablesApi()
  const fieldsStore = useFieldsStore()

  return async (tableAddress: string): Promise<ITable> => {
    const [response] = await Promise.all([
      api.get(tableAddress),
      fieldsStore.fetchFields(tableAddress),
    ])

    return response.table
  }
}
