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
    options: (tableAddress: string, fieldId: string) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(tableAddress, fieldId)),
    /** `signal` is aborted when a newer term supersedes this request. */
    search: (tableAddress: string, fieldId: string, term: string, signal: AbortSignal) =>
      api<IRelationOptionsResponse>(apiPath.fieldOptions(tableAddress, fieldId), {
        query: { q: term },
        signal,
      }),
  }
}
