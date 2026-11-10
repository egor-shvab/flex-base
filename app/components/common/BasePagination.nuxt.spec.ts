import { afterEach, describe, expect, it } from 'vitest'

import BasePagination from '~/components/common/BasePagination.vue'
import { mountTracked, unmountAll } from '~~/test/mount'

interface IPageProps {
  page: number
  pageCount: number
  pageSize: number
  total: number
  totalCapped: boolean
  hasNext: boolean
}

function mount(props: Partial<IPageProps> = {}) {
  return mountTracked(BasePagination, {
    props: {
      page: 1,
      pageCount: 1,
      pageSize: 50,
      total: 0,
      totalCapped: false,
      hasNext: false,
      ...props,
    },
  })
}

type TPager = Awaited<ReturnType<typeof mount>>

const previousOf = (wrapper: TPager) => wrapper.get('button[aria-label="Previous"]')
const nextOf = (wrapper: TPager) => wrapper.get('button[aria-label="Next"]')
const pagesOf = (wrapper: TPager) =>
  wrapper
    .findAll('.pagination__pager > *')
    .slice(1, -1)
    .map((cell) => cell.text())

const rangeOf = async (props: Partial<IPageProps>) =>
  (await mount(props)).find('.pagination__count').text()

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
  it('draws the window of pages between the two arrows', async () => {
    const wrapper = await mount({ page: 5, pageCount: 10, total: 500, hasNext: true })

    expect(pagesOf(wrapper)).toEqual(['1', '…', '4', '5', '6', '…', '10'])
  })

  it('marks the current page, and names every page for assistive tech', async () => {
    const wrapper = await mount({ page: 2, pageCount: 3, total: 120, hasNext: true })
    const current = wrapper.get('[aria-current="page"]')

    expect(current.text()).toBe('2')
    expect(current.attributes('aria-label')).toBe('Page 2')
    expect(wrapper.find('.pagination__gap').exists()).toBe(false)
  })

  it('jumps to a page it is given, and ignores the current one', async () => {
    const wrapper = await mount({ page: 2, pageCount: 3, total: 120, hasNext: true })

    await wrapper.get('button[aria-label="Page 3"]').trigger('click')
    await wrapper.get('button[aria-label="Page 2"]').trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[3]])
  })

  it('hides the gap from assistive tech', async () => {
    const wrapper = await mount({ page: 5, pageCount: 10, total: 500, hasNext: true })

    expect(wrapper.get('.pagination__gap').attributes('aria-hidden')).toBe('true')
  })

  it('announces the range politely, since it changes without focus moving', async () => {
    const wrapper = await mount({ total: 120, pageCount: 3 })

    expect(wrapper.find('.pagination__count').attributes('role')).toBe('status')
  })

  it('offers no way back from the first page', async () => {
    const wrapper = await mount({ page: 1, pageCount: 3, total: 120, hasNext: true })

    expect(previousOf(wrapper).attributes('disabled')).toBeDefined()
    expect(nextOf(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('offers no way on from the last page', async () => {
    const wrapper = await mount({ page: 3, pageCount: 3, total: 120 })

    expect(previousOf(wrapper).attributes('disabled')).toBeUndefined()
    expect(nextOf(wrapper).attributes('disabled')).toBeDefined()
  })

  it('disables both ends when there is only one page', async () => {
    const wrapper = await mount({ page: 1, pageCount: 1, total: 3 })

    expect(previousOf(wrapper).attributes('disabled')).toBeDefined()
    expect(nextOf(wrapper).attributes('disabled')).toBeDefined()
  })

  it('steps one page at a time in each direction', async () => {
    const wrapper = await mount({ page: 2, pageCount: 3, total: 120, hasNext: true })

    await previousOf(wrapper).trigger('click')
    await nextOf(wrapper).trigger('click')

    expect(wrapper.emitted('update:page')).toEqual([[1], [3]])
  })
})

describe('a capped total', () => {
  it('marks the range as a floor rather than a count', async () => {
    expect(await rangeOf({ page: 1, pageSize: 50, total: 1000, totalCapped: true })).toBe(
      '1–50 of 1000+',
    )
  })

  it('draws no last page, which a capped total cannot establish', async () => {
    const wrapper = await mount({ page: 3, pageCount: 20, total: 1000, totalCapped: true })

    expect(pagesOf(wrapper)).toEqual(['1', '2', '3', '4', '…'])
  })

  it('still offers Next on the last page the cap can describe', async () => {
    const wrapper = await mount({
      page: 20,
      pageCount: 20,
      total: 1000,
      totalCapped: true,
      hasNext: true,
    })
    expect(nextOf(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('stops offering Next once a page comes back short', async () => {
    const wrapper = await mount({ page: 21, pageCount: 20, total: 1000, totalCapped: true })
    expect(nextOf(wrapper).attributes('disabled')).toBeDefined()
  })
})
