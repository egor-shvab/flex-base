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
  /**
   * The table's field metadata. A getter rather than the store itself, so this owns the URL
   * and nothing else — filters decode against metadata, but where that metadata came from is
   * the page's business.
   */
  fields: () => IField[]
}

/**
 * The records list query, read from and written to the URL.
 *
 * The URL is the source of truth: every way of narrowing, ordering or paging the list is a
 * navigation, which is what makes a filtered view shareable, survive a reload, and render
 * server-side already filtered. Nothing here holds list state of its own.
 *
 * One owner per page — the page reads what this returns and keeps the fetching, because what
 * to fetch and how to say it in a URL are separate questions.
 */
export function useRecordListQuery({ fields }: IRecordListQueryInput) {
  const route = useRoute()

  const queryState = computed<IRecordQueryState>(() => parseRecordQueryState(fields(), route.query))

  const filters = computed(() => queryState.value.filters)

  /** One filtered field counts once, however many conditions its control implies. */
  const activeFilterCount = computed(() => Object.keys(filters.value).length)

  /** Whether the list is showing less than the whole table, by filter or by search. */
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

  /** The same decision the copy above makes, in a glyph: what is keeping the list empty. */
  const emptyIcon = computed(() => {
    if (!isNarrowed.value) return 'mdi:table'
    return activeFilterCount.value === 0 ? 'mdi:magnify' : 'mdi:filter-variant'
  })

  function applyQuery(params: IRecordQueryState, replace = false) {
    // Sort and page steps are worth a history entry; live filter edits would flood it
    return navigateTo({ query: toRecordQueryParams(params) }, { replace })
  }

  /** `replace` for a move the user did not ask for — the page-1 hop after creating a record. */
  function goToPage(nextPage: number, replace = false) {
    return applyQuery({ ...queryState.value, page: nextPage }, replace)
  }

  /** Re-clicking the sorted column flips it; a new column starts ascending. */
  function applySort(key: string) {
    const { sort } = queryState.value
    const dir = sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc'
    return applyQuery({ ...queryState.value, page: 1, sort: { key, dir } })
  }

  function applyFilters(next: TRecordFilterValues) {
    return applyQuery({ ...queryState.value, page: 1, filters: next }, true)
  }

  /**
   * Below the minimum the term is dropped rather than sent: the schema rejects it anyway, and
   * an unanchored match across every field is not worth running for one character.
   */
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
    isNarrowed,
    emptyTitle,
    emptyMessage,
    emptyIcon,
    /**
     * A stable string for a watcher to key on. `queryState` is a fresh object whenever *any*
     * param moves — including the detail dialog's — and the list must not refetch because a
     * dialog opened.
     */
    queryKey: computed(() => recordQueryKey(queryState.value)),
    goToPage,
    applySort,
    applyFilters,
    applySearch,
    clearNarrowing,
  }
}
