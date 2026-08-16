import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import type { IField } from '#shared/types/field'
import { parseRecordQueryState } from '#shared/utils/record-query'
import { useRecordListQuery } from '~/composables/useRecordListQuery'
import { numberField, selectField, textField } from '~~/test/fixtures'

const navigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateTo)

const routeQuery = ref<Record<string, string | string[]>>({})
// A getter, not a snapshot: the composable calls `useRoute()` once and reads `route.query`
// from inside computeds, so the query has to stay reactive after setup for a navigation to
// be observable at all
const route = {
  get query() {
    return routeQuery.value
  },
}
mockNuxtImport('useRoute', () => () => route)

const FIELDS = [textField('company'), numberField('contract_value'), selectField(['Won', 'Lost'])]

function setup(query: Record<string, string | string[]> = {}, fields: IField[] = FIELDS) {
  routeQuery.value = query
  return useRecordListQuery({ fields: () => fields })
}

/** The target of the single navigation a call produced. */
function navigation() {
  expect(navigateTo).toHaveBeenCalledTimes(1)
  const [target, options] = navigateTo.mock.calls[0] ?? []

  return { query: target?.query as Record<string, unknown>, replace: options?.replace as boolean }
}

/**
 * The sort the emitted URL actually means, read back through the codec. Necessary because
 * `desc` is the default direction and is therefore *absent* from the params — asserting on
 * `dir` being undefined would read as "unsorted" when it means "descending".
 */
function emittedSort() {
  return parseRecordQueryState(FIELDS, navigation().query).sort
}

beforeEach(() => {
  navigateTo.mockReset()
  routeQuery.value = {}
})

describe('reading the URL', () => {
  it('decodes the list query against the field metadata it is given', () => {
    const { queryState } = setup({ company: 'acme', page: '2', sort: 'company', dir: 'desc' })

    expect(queryState.value).toMatchObject({
      page: 2,
      sort: { key: 'company', dir: 'desc' },
      filters: { company: 'acme' },
    })
  })

  it('follows the fields as they arrive, since metadata is fetched after the first read', () => {
    // The page renders before `fetchFields` resolves; a filter must not be dropped for good
    // because the field it names was not known yet
    const fields = ref<IField[]>([])
    const { filters } = useRecordListQuery({ fields: () => fields.value })
    routeQuery.value = { company: 'acme' }

    expect(filters.value).toEqual({})

    fields.value = FIELDS
    expect(filters.value).toEqual({ company: 'acme' })
  })
})

describe('whether the list is narrowed', () => {
  it('is not, on a bare table', () => {
    expect(setup().isNarrowed.value).toBe(false)
  })

  it('is, for a filter alone', () => {
    expect(setup({ company: 'acme' }).isNarrowed.value).toBe(true)
  })

  it('is, for a search alone', () => {
    expect(setup({ search: 'acme' }).isNarrowed.value).toBe(true)
  })

  it('ignores paging and sorting, which show the whole table either way', () => {
    expect(setup({ page: '3', sort: 'company', dir: 'desc' }).isNarrowed.value).toBe(false)
  })
})

/**
 * A range spreads to two params but is one filtered field, so the copy below counts fields
 * rather than conditions — "this filter" must not appear for a single range.
 */
describe('the empty-state copy', () => {
  const copy = (query: Record<string, string | string[]>) => {
    const { emptyTitle, emptyMessage } = setup(query)
    return { title: emptyTitle.value, message: emptyMessage.value }
  }

  it('invites a first record when nothing is narrowing the list', () => {
    expect(copy({})).toEqual({
      title: 'No records yet',
      message: 'Add your first record to see it here.',
    })
  })

  it('names the term when only a search is narrowing it', () => {
    expect(copy({ search: 'acme' })).toEqual({
      title: 'Nothing matches “acme”',
      message: 'Check the spelling, or try a shorter word.',
    })
  })

  it('speaks of one filter in the singular', () => {
    expect(copy({ company: 'acme' })).toEqual({
      title: 'No records match this filter',
      message: 'This table has records, but none match all of these filters at once.',
    })
  })

  it('counts a two-bound range as the one filter it is', () => {
    expect(copy({ contract_value_from: '100', contract_value_to: '500' }).title).toBe(
      'No records match this filter',
    )
  })

  it('speaks of filters in the plural once there are two', () => {
    expect(copy({ company: 'acme', stage: 'Won' }).title).toBe(
      'No records match what you are looking for',
    )
  })

  it('blames both when a search and a filter are combined', () => {
    expect(copy({ company: 'acme', search: 'beta' })).toEqual({
      title: 'No records match what you are looking for',
      message: 'This table has records, but none match both your search and your filters.',
    })
  })
})

/** The same four cases as the copy above, said in a glyph: what is keeping the list empty. */
describe('the empty-state icon', () => {
  const icon = (query: Record<string, string | string[]>) => setup(query).emptyIcon.value

  it('is the table itself when nothing is narrowing the list', () => {
    expect(icon({})).toBe('mdi:table')
  })

  it('is the search glyph when only a search is narrowing it', () => {
    expect(icon({ search: 'acme' })).toBe('mdi:magnify')
  })

  it('is the filter glyph for a filter', () => {
    expect(icon({ company: 'acme' })).toBe('mdi:filter-variant')
  })

  it('stays the filter glyph when a search and a filter are combined', () => {
    // The filter is the narrower claim of the two, and the one the user can clear wholesale
    expect(icon({ company: 'acme', search: 'beta' })).toBe('mdi:filter-variant')
  })
})

describe('sorting', () => {
  it('starts a fresh column ascending', () => {
    setup().applySort('company')

    expect(emittedSort()).toEqual({ key: 'company', dir: 'asc' })
  })

  it('flips the column that is already sorted', () => {
    setup({ sort: 'company', dir: 'asc' }).applySort('company')

    expect(emittedSort()).toEqual({ key: 'company', dir: 'desc' })
  })

  it('flips back rather than sticking on descending', () => {
    setup({ sort: 'company', dir: 'desc' }).applySort('company')

    expect(emittedSort()).toEqual({ key: 'company', dir: 'asc' })
  })

  it('starts ascending again when the column changes, whatever the old direction was', () => {
    setup({ sort: 'company', dir: 'desc' }).applySort('stage')

    expect(emittedSort()).toEqual({ key: 'stage', dir: 'asc' })
  })

  it('returns to the first page, since row 51 of the old order means nothing', () => {
    setup({ page: '4' }).applySort('company')

    expect(navigation().query.page).toBeUndefined()
  })
})

describe('searching', () => {
  it('sends a term at the floor', () => {
    setup().applySearch('ac')

    expect(navigation().query).toMatchObject({ search: 'ac' })
  })

  it('drops a term below the floor rather than sending one the schema would reject', () => {
    setup({ search: 'acme' }).applySearch('a')

    expect(navigation().query.search).toBeUndefined()
  })

  it('trims before measuring, so padding cannot smuggle a short term through', () => {
    setup({ search: 'acme' }).applySearch('  a  ')

    expect(navigation().query.search).toBeUndefined()
  })

  it('trims a real term too', () => {
    setup().applySearch('  acme  ')

    expect(navigation().query).toMatchObject({ search: 'acme' })
  })

  /** A debounced input re-emits the settled value; navigating again would flood history. */
  it('does not navigate when the term has not actually changed', () => {
    setup({ search: 'acme' }).applySearch('acme')

    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('does not navigate when a blank stays blank', () => {
    setup().applySearch('  ')

    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('returns to the first page', () => {
    setup({ page: '4' }).applySearch('acme')

    expect(navigation().query.page).toBeUndefined()
  })
})

describe('filtering', () => {
  it('writes the filters it is handed', () => {
    setup().applyFilters({ company: 'acme' })

    expect(navigation().query).toMatchObject({ company: 'acme' })
  })

  it('replaces the filters rather than merging with what was there', () => {
    setup({ company: 'acme', stage: 'Won' }).applyFilters({ company: 'beta' })

    const { query } = navigation()
    expect(query).toMatchObject({ company: 'beta' })
    expect(query.stage).toBeUndefined()
  })

  it('returns to the first page', () => {
    setup({ page: '4' }).applyFilters({ company: 'acme' })

    expect(navigation().query.page).toBeUndefined()
  })

  it('clears the search and every filter at once, keeping the sort', () => {
    setup({
      company: 'acme',
      search: 'beta',
      page: '3',
      sort: 'company',
      dir: 'asc',
    }).clearNarrowing()

    expect(navigation().query).toEqual({ sort: 'company', dir: 'asc' })
  })
})

describe('paging', () => {
  it('goes where it is sent, keeping the narrowing in place', () => {
    setup({ company: 'acme' }).goToPage(3)

    expect(navigation().query).toMatchObject({ company: 'acme', page: '3' })
  })

  it('drops the param entirely for page 1, keeping an unfiltered view a clean link', () => {
    setup({ page: '3' }).goToPage(1)

    expect(navigation().query.page).toBeUndefined()
  })
})

/**
 * Which actions leave a history entry is invisible until someone presses Back. Steps the user
 * asked for are worth an entry; a live filter edit fires per keystroke and would bury the page
 * they arrived from.
 */
describe('what browser Back walks through', () => {
  it('records a sort as a step', () => {
    setup().applySort('company')
    expect(navigation().replace).toBe(false)
  })

  it('records a page as a step', () => {
    setup().goToPage(2)
    expect(navigation().replace).toBe(false)
  })

  it('replaces on a filter edit', () => {
    setup().applyFilters({ company: 'acme' })
    expect(navigation().replace).toBe(true)
  })

  it('replaces on a search', () => {
    setup().applySearch('acme')
    expect(navigation().replace).toBe(true)
  })

  it('replaces on clearing', () => {
    setup({ company: 'acme' }).clearNarrowing()
    expect(navigation().replace).toBe(true)
  })

  it('replaces on the page hop that follows creating a record, which nobody asked for', () => {
    setup({ page: '3' }).goToPage(1, true)
    expect(navigation().replace).toBe(true)
  })
})

describe('queryKey', () => {
  it('is empty for the default view', () => {
    expect(setup().queryKey.value).toBe('')
  })

  it('changes when the list query really changes', () => {
    const { queryKey } = setup({ company: 'acme' })
    const before = queryKey.value

    routeQuery.value = { company: 'beta' }
    expect(queryKey.value).not.toBe(before)
  })

  /** The whole reason it exists: opening the detail dialog must not refetch the list. */
  it('is unmoved by a param the list does not own', () => {
    const { queryKey } = setup({ company: 'acme' })
    const before = queryKey.value

    routeQuery.value = { company: 'acme', detail: 'tbl_1.rec_1' }
    expect(queryKey.value).toBe(before)
  })
})
