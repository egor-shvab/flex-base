import { useApi } from '~/api/client'
import { apiPath } from '~/api/paths'
import type { IRelationOptionsResponse } from '#shared/types/api'

/**
 * A relation field's candidates. Two calls over one route, kept apart because they mean
 * different things to the store above: `options` is the seed list it caches, `search` is a
 * narrowing it deliberately does not (`decisions.md`).
 */
export function useRelationsApi() {
  const api = useApi()

  return {
    options: (tableId: string, fieldId: string) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(tableId, fieldId)),
    /** `signal` is aborted when a newer term supersedes this request. */
    search: (tableId: string, fieldId: string, term: string, signal: AbortSignal) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(tableId, fieldId), {
        query: { q: term },
        signal,
      }),
  }
}
