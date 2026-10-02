import { computed } from 'vue'
import { navigateTo, useRoute } from '#imports'
import { SEARCH_MIN_LENGTH } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import type { IRecordQueryState } from '#shared/types/record'
import {
  parseRecordQueryState,
  recordQueryKey,
  toRecordQueryParams,
} from '#shared/utils/record-query'

interface IRecordListQueryInput {
  fields: () => IField[]
}

/**
 * The records list query, read from and written to the URL — the source of truth. One owner per
 * page; the page keeps the fetching.
 */
export function useRecordListQuery({ fields }: IRecordListQueryInput) {
  const route = useRoute()

  const queryState = computed<IRecordQueryState>(() => parseRecordQueryState(fields(), route.query))

  const filters = computed(() => queryState.value.filters)

  const activeFilterCount = computed(() => Object.keys(filters.value).length)

  const isNarrowed = computed(() => activeFilterCount.value > 0 || queryState.value.search !== '')

  const emptyTitle = computed(() => {
    if (!isNarrowed.value) return 'No records yet'
    if (queryState.value.search && activeFilterCount.value === 0) {
      return `Nothing matches “${queryState.value.search}”`
    }
    return activeFilterCount.value === 1 && !queryState.value.search
      ? 'No records match this filter'
      : 'No records match what you are looking for'
  })

  const emptyMessage = computed(() => {
    if (!isNarrowed.value) return 'Add your first record to see it here.'
    if (queryState.value.search && activeFilterCount.value === 0) {
      return 'Check the spelling, or try a shorter word.'
    }
    return queryState.value.search
      ? 'This table has records, but none match both your search and your filters.'
      : 'This table has records, but none match all of these filters at once.'
  })

  const emptyIcon = computed(() => {
    if (!isNarrowed.value) return 'material-symbols:table-outline-rounded'
    return activeFilterCount.value === 0
      ? 'material-symbols:search-rounded'
      : 'material-symbols:filter-list-rounded'
  })

  function applyQuery(params: IRecordQueryState, replace = false) {
    return navigateTo({ query: toRecordQueryParams(params) }, { replace })
  }

  function goToPage(nextPage: number, replace = false) {
    return applyQuery({ ...queryState.value, page: nextPage }, replace)
  }

  function applySort(key: string) {
    const { sort } = queryState.value
    const direction = sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc'
    return applyQuery({ ...queryState.value, page: 1, sort: { key, direction } })
  }

  function applyFilters(next: TRecordFilterValues) {
    return applyQuery({ ...queryState.value, page: 1, filters: next }, true)
  }

  function applySearch(next: string) {
    const search = next.trim().length >= SEARCH_MIN_LENGTH ? next.trim() : ''
    if (search === queryState.value.search) return

    return applyQuery({ ...queryState.value, page: 1, search }, true)
  }

  function clearNarrowing() {
    return applyQuery({ ...queryState.value, page: 1, filters: {}, search: '' }, true)
  }

  return {
    queryState,
    filters,
    activeFilterCount,
    isNarrowed,
    emptyTitle,
    emptyMessage,
    emptyIcon,
    queryKey: computed(() => recordQueryKey(queryState.value)),
    goToPage,
    applySort,
    applyFilters,
    applySearch,
    clearNarrowing,
  }
}
