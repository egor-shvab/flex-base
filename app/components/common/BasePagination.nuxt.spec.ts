import { afterEach, describe, expect, it } from 'vitest'

import BasePagination from '~/components/common/BasePagination.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

interface IPageProps {
  page: number
  pageCount: number
  pageSize: number
  total: number
}

function mount(props: Partial<IPageProps> = {}) {
  return mountTracked(BasePagination, {
    props: { page: 1, pageCount: 1, pageSize: 50, total: 0, ...props },
  })
}

const rangeOf = async (props: Partial<IPageProps>) =>
  (await mount(props)).find('.pagination__count').text()

/**
 * The range is derived from the page numbers alone — the control never sees the rows — so
 * every boundary is arithmetic that no other test would catch.
 */
describe('the range label', () => {
  afterEach(unmountAll)

  it('says nothing is there rather than "1–0 of 0"', async () => {
    expect(await rangeOf({ total: 0 })).toBe('0 of 0')
  })

  it('counts from one, not from zero', async () => {
    expect(await rangeOf({ page: 1, pageSize: 50, total: 120, pageCount: 3 })).toBe('1–50 of 120')
  })

  it('starts a later page where the previous one ended', async () => {
    expect(await rangeOf({ page: 2, pageSize: 50, total: 120, pageCount: 3 })).toBe('51–100 of 120')
  })

  it('stops at the total on a partial last page', async () => {
    expect(await rangeOf({ page: 3, pageSize: 50, total: 120, pageCount: 3 })).toBe(
      '101–120 of 120',
    )
  })

  it('does not overshoot when the last page is exactly full', async () => {
    expect(await rangeOf({ page: 2, pageSize: 50, total: 100, pageCount: 2 })).toBe('51–100 of 100')
  })

  it('reads sensibly for a single record', async () => {
    expect(await rangeOf({ page: 1, pageSize: 50, total: 1, pageCount: 1 })).toBe('1–1 of 1')
  })
})

describe('the pager', () => {
  it('names the page and the total count of pages', async () => {
    const wrapper = await mount({ page: 2, pageCount: 3, total: 120 })

    expect(wrapper.find('.pagination__page').text()).toBe('Page 2 of 3')
  })

  /**
   * `role="status"` rather than a bare `aria-live="polite"`: the role implies polite-live, so
   * assistive tech hears the same thing, and the range gains a role a reader can address.
   */
  it('announces the range politely, since it changes without focus moving', async () => {
    const wrapper = await mount({ total: 120, pageCount: 3 })

    expect(wrapper.find('.pagination__count').attributes('role')).toBe('status')
  })

  it('offers no way back from the first page', async () => {
    const wrapper = await mount({ page: 1, pageCount: 3, total: 120 })
    const [previous, next] = wrapper.findAll('button')

    expect(previous?.attributes('disabled')).toBeDefined()
    expect(next?.attributes('disabled')).toBeUndefined()
  })

  it('offers no way on from the last page', async () => {
    const wrapper = await mount({ page: 3, pageCount: 3, total: 120 })
    const [previous, next] = wrapper.findAll('button')

    expect(previous?.attributes('disabled')).toBeUndefined()
    expect(next?.attributes('disabled')).toBeDefined()
  })

  it('disables both ends when there is only one page', async () => {
    const wrapper = await mount({ page: 1, pageCount: 1, total: 3 })

    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })

  it('steps one page at a time in each direction', async () => {
    const wrapper = await mount({ page: 2, pageCount: 3, total: 120 })
    const [previous, next] = wrapper.findAll('button')

    await previous?.trigger('click')
    await next?.trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[1], [3]])
  })
})
