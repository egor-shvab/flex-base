import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { TUrlQuery } from '#shared/types/query'
import { useDetailLink } from '~/composables/useDetailLink'

const routeQuery = vi.hoisted(() => ({ value: {} as TUrlQuery }))

mockNuxtImport('useRoute', () => () => ({ query: routeQuery.value }))

function at(query: TUrlQuery) {
  routeQuery.value = query
}

describe('useDetailLink', () => {
  it('opens a record from a list view as a one-entry chain', () => {
    at({})

    const link = useDetailLink()({ tableAddress: 'tbl_deals', recordAddress: 'rec_1' })

    expect(link.query.detail).toBe('tbl_deals.rec_1')
  })

  it('keeps the surrounding list query intact', () => {
    at({ page: '3', sort: 'name:asc', 'f.stage': 'Won' })

    const link = useDetailLink()({ tableAddress: 'tbl_deals', recordAddress: 'rec_1' })

    expect(link.query).toMatchObject({ page: '3', sort: 'name:asc', 'f.stage': 'Won' })
  })

  it('drills rather than replaces when already inside the dialog', () => {
    at({ detail: 'tbl_deals.rec_1' })

    const link = useDetailLink()({ tableAddress: 'tbl_people', recordAddress: 'rec_9' })

    expect(link.query.detail).toBe('tbl_deals.rec_1,tbl_people.rec_9')
  })

  it('appends to a chain of any depth', () => {
    at({ detail: 'tbl_a.rec_1,tbl_b.rec_2' })

    const link = useDetailLink()({ tableAddress: 'tbl_c', recordAddress: 'rec_3' })

    expect(link.query.detail).toBe('tbl_a.rec_1,tbl_b.rec_2,tbl_c.rec_3')
  })

  it('drops a malformed existing chain instead of failing', () => {
    at({ detail: 'not-a-ref' })

    const link = useDetailLink()({ tableAddress: 'tbl_deals', recordAddress: 'rec_1' })

    expect(link.query.detail).toBe('tbl_deals.rec_1')
  })

  it('returns a fresh target per call, so one link cannot mutate another', () => {
    at({ detail: 'tbl_deals.rec_1' })
    const detailLink = useDetailLink()

    const first = detailLink({ tableAddress: 'tbl_people', recordAddress: 'rec_9' })
    const second = detailLink({ tableAddress: 'tbl_people', recordAddress: 'rec_8' })

    expect(first.query.detail).toBe('tbl_deals.rec_1,tbl_people.rec_9')
    expect(second.query.detail).toBe('tbl_deals.rec_1,tbl_people.rec_8')
  })
})
