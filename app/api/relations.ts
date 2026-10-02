import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IRelationOptionsResponse } from '#shared/types/api'

export function useRelationsApi() {
  const api = useApi()

  return {
    options: (tableAddress: string, fieldId: string) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(tableAddress, fieldId)),
    search: (tableAddress: string, fieldId: string, term: string, signal: AbortSignal) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(tableAddress, fieldId), {
        query: { q: term },
        signal,
      }),
  }
}
