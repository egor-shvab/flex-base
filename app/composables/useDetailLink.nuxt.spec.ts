import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { TUrlQuery } from '#shared/types/query'
import { useDetailLink } from '~/composables/useDetailLink'

const routeQuery = vi.hoisted(() => ({ value: {} as TUrlQuery }))

mockNuxtImport('useRoute', () => () => ({ query: routeQuery.value }))

/** Sets the query the composable will read as "where the user currently is". */
function at(query: TUrlQuery) {
  routeQuery.value = query
}

describe('useDetailLink', () => {
  it('opens a record from a list view as a one-entry chain', () => {
    at({})

    const link = useDetailLink()({ tableId: 'tbl_deals', recordId: 'rec_1' })

    expect(link.query.detail).toBe('tbl_deals.rec_1')
  })

  /**
   * The whole reason this is a query layered onto the current route rather than a path: the
   * list the dialog opens over must survive being navigated.
   */
  it('keeps the surrounding list query intact', () => {
    at({ page: '3', sort: 'name:asc', 'f.stage': 'Won' })

    const link = useDetailLink()({ tableId: 'tbl_deals', recordId: 'rec_1' })

    expect(link.query).toMatchObject({ page: '3', sort: 'name:asc', 'f.stage': 'Won' })
  })

  it('drills rather than replaces when already inside the dialog', () => {
    at({ detail: 'tbl_deals.rec_1' })

    const link = useDetailLink()({ tableId: 'tbl_people', recordId: 'rec_9' })

    // The trail behind it is what Back walks up
    expect(link.query.detail).toBe('tbl_deals.rec_1,tbl_people.rec_9')
  })

  it('appends to a chain of any depth', () => {
    at({ detail: 'tbl_a.rec_1,tbl_b.rec_2' })

    const link = useDetailLink()({ tableId: 'tbl_c', recordId: 'rec_3' })

    expect(link.query.detail).toBe('tbl_a.rec_1,tbl_b.rec_2,tbl_c.rec_3')
  })

  /** A malformed link degrades to a shorter trail rather than throwing — see `parseDetailChain`. */
  it('drops a malformed existing chain instead of failing', () => {
    at({ detail: 'not-a-ref' })

    const link = useDetailLink()({ tableId: 'tbl_deals', recordId: 'rec_1' })

    expect(link.query.detail).toBe('tbl_deals.rec_1')
  })

  it('returns a fresh target per call, so one link cannot mutate another', () => {
    at({ detail: 'tbl_deals.rec_1' })
    const detailLink = useDetailLink()

    const first = detailLink({ tableId: 'tbl_people', recordId: 'rec_9' })
    const second = detailLink({ tableId: 'tbl_people', recordId: 'rec_8' })

    expect(first.query.detail).toBe('tbl_deals.rec_1,tbl_people.rec_9')
    expect(second.query.detail).toBe('tbl_deals.rec_1,tbl_people.rec_8')
  })
})
