import { useTablesApi } from '~/api/tables'
import { useFieldsStore } from '~/stores/fields'
import type { ITable } from '#shared/types/table'

/**
 * What both table screens open with: the table itself and its field metadata, fetched together
 * because neither screen can draw anything without both.
 *
 * **It owns neither the `useAsyncData` nor the error.** Each page keeps its own call because the
 * two must key differently, and a shared key is the bug `docs/decisions.md` records — keeping
 * the key at the call site is what keeps that visible. The 404 stays there too: it is the page's
 * own answer, and `toPageError` decides whether a cause may be asserted.
 *
 * A composable returning a loader rather than a plain async function, because `useApi()` wraps
 * `useRequestFetch()` and has to be called during setup.
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
