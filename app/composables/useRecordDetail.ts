import { computed } from 'vue'
import { useAsyncData, useRoute } from '#imports'
import type { TUrlQuery } from '#shared/types/query'
import type { IOpenRecord, IRecordDetail } from '#shared/types/record'
import { parseDetailChain, popDetail, withDetailChain } from '#shared/utils/record-detail'
import { useRecordsApi } from '~/api/records'
import { useRelationsStore } from '~/stores/relations'
import { getApiErrorMessage } from '~/utils/api-error'

/**
 * The record-detail dialog, read from and written to the URL. One owner per page — the dialog
 * reads what this returns instead of fetching its own.
 */
export function useRecordDetail() {
  const route = useRoute()
  const api = useRecordsApi()
  const relations = useRelationsStore()

  const chain = computed(() => parseDetailChain(route.query))

  const current = computed(() => chain.value.at(-1))

  const currentKey = computed(() =>
    current.value === undefined
      ? ''
      : `${current.value.tableAddress}.${current.value.recordAddress}`,
  )

  const { data, status, error, refresh } = useAsyncData<IRecordDetail | null>(
    // Keyed on the record: a constant key would be shared across table pages and the second would
    // keep the first's entry without refetching
    () => `record-detail-${currentKey.value}`,
    async () => {
      const openRecord = current.value
      if (openRecord === undefined) return null

      const detail = await api.detail(openRecord.tableAddress, openRecord.recordAddress)
      relations.cacheLinkedRecords(detail.linkedRecords)
      return detail
    },
    { default: () => null },
  )

  const notFound = computed(() => error.value?.statusCode === 404)

  const errorMessage = computed(() => {
    if (!error.value) return null
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
    canRetry: computed(() => Boolean(error.value) && !notFound.value),
    refresh,
    backTo: computed(() =>
      chain.value.length > 1 ? queryWith(popDetail(chain.value)) : undefined,
    ),
    closeTo: computed(() => queryWith([])),
  }
}
