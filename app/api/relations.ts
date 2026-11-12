import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IRelationOptionsResponse } from '#shared/types/api'

export function useRelationsApi() {
  const api = useApi()

  return {
    options: (workspaceAddress: string, tableAddress: string, fieldId: string) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(workspaceAddress, tableAddress, fieldId)),
    search: (
      workspaceAddress: string,
      tableAddress: string,
      fieldId: string,
      term: string,
      signal: AbortSignal,
    ) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(workspaceAddress, tableAddress, fieldId), {
        query: { q: term },
        signal,
      }),
  }
}
