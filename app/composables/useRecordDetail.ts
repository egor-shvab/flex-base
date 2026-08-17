import { computed } from 'vue'
import { useAsyncData, useRoute } from '#imports'
import type { TUrlQuery } from '#shared/types/query'
import type { IOpenRecord, IRecordDetail } from '#shared/types/record'
import { parseDetailChain, popDetail, withDetailChain } from '#shared/utils/record-detail'
import { useRecordsApi } from '~/api/records'
import { useRelationsStore } from '~/stores/relations'
import { getApiErrorMessage } from '~/utils/api-error'

/**
 * The record-detail dialog, read from and written to the URL.
 *
 * The `detail` param holds the trail of records the dialog has open, so every control here is
 * a route target rather than a state change: opening, drilling into a nested relation, going
 * back and closing are all ordinary navigations, which is what makes browser Back reverse
 * exactly one step and a shared link render the same dialog server-side.
 *
 * One owner per page — the dialog reads what this returns instead of fetching its own.
 */
export function useRecordDetail() {
  const route = useRoute()
  const api = useRecordsApi()
  const relations = useRelationsStore()

  const chain = computed(() => parseDetailChain(route.query))

  /** Only the last entry is shown; the ones before it are what Back walks up. */
  const current = computed(() => chain.value.at(-1))

  /**
   * A string, not the object itself: `parseDetailChain` returns fresh objects on every query
   * change, so watching the object would refetch when an unrelated param moved.
   */
  const currentKey = computed(() =>
    current.value === undefined ? '' : `${current.value.tableId}.${current.value.recordId}`,
  )

  const { data, status, error, refresh } = useAsyncData<IRecordDetail | null>(
    'record-detail',
    async () => {
      const openRecord = current.value
      if (openRecord === undefined) return null

      const detail = await api.detail(openRecord.tableId, openRecord.recordId)
      // The same merge-only cache the list feeds, so a relation *inside* the dialog resolves
      // to a linked record and can link on again
      relations.cacheLinkedRecords(detail.linkedRecords)
      return detail
    },
    // `null` rather than `undefined` while it loads: "no record open" is a state the dialog
    // renders, not the absence of an answer
    { watch: [currentKey], default: () => null },
  )

  const notFound = computed(() => error.value?.statusCode === 404)

  const errorMessage = computed(() => {
    if (!error.value) return null
    // The one status that names its own cause: the record was deleted after the link was drawn
    return notFound.value ? 'This record no longer exists.' : getApiErrorMessage(error.value)
  })

  function queryWith(next: IOpenRecord[]): { query: TUrlQuery } {
    return { query: withDetailChain(route.query, next) }
  }

  return {
    chain,
    detail: data,
    pending: computed(() => status.value === 'pending'),
    errorMessage,
    /** Retrying a 404 cannot help, so the dialog does not offer it. */
    canRetry: computed(() => Boolean(error.value) && !notFound.value),
    refresh,
    /** Present only when there is somewhere to go back to. */
    backTo: computed(() =>
      chain.value.length > 1 ? queryWith(popDetail(chain.value)) : undefined,
    ),
    closeTo: computed(() => queryWith([])),
  }
}
