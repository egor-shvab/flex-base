import { useTablesApi } from '~/api/tables'
import { useFieldsStore } from '~/stores/fields'
import type { ITableResponse } from '#shared/types/api'

/**
 * Loads a table, the caller's access to its records and its fields together. Owns neither the `useAsyncData` nor the error: each page
 * must key its own call, and a shared key is a known bug.
 */
export function useTableLoader() {
  const api = useTablesApi()
  const fieldsStore = useFieldsStore()

  return async (workspaceAddress: string, tableAddress: string): Promise<ITableResponse> => {
    const [response] = await Promise.all([
      api.get(workspaceAddress, tableAddress),
      fieldsStore.fetchFields(workspaceAddress, tableAddress),
    ])

    return response
  }
}
