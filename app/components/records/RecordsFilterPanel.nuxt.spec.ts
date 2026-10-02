import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nextTick } from 'vue'
import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import RecordsFilterPanel from '~/components/records/RecordsFilterPanel.vue'
import { asMultiple, booleanField, numberField, selectField, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const FIELDS: IField[] = [
  textField('company', { name: 'Company' }),
  numberField('salary', { name: 'Salary' }),
  booleanField('active', { name: 'Active' }),
]

function panel(
  props: {
    fields?: IField[]
    filters?: TRecordFilterValues
    total?: number
    totalCapped?: boolean
    pending?: boolean
  } = {},
) {
  return mountTracked(RecordsFilterPanel, {
    props: {
      fields: props.fields ?? FIELDS,
      filters: props.filters ?? {},
      total: props.total ?? 12,
      totalCapped: props.totalCapped ?? false,
      pending: props.pending ?? false,
    },
  })
}

type TPanel = Awaited<ReturnType<typeof panel>>

const drawer = () => document.querySelector<HTMLElement>('.base-modal--drawer')
const controls = () => [
  ...document.querySelectorAll<HTMLElement>('.filter-panel > :not(.filter-panel__intro)'),
]
const labels = () =>
  [...document.querySelectorAll('.filter-panel label, .filter-panel .base-segmented__label')].map(
    (label) => label.textContent?.trim(),
  )
const count = () => document.querySelector('.filter-panel__count')?.textContent?.trim()
const clearAll = () =>
  [...document.querySelectorAll<HTMLElement>('.filter-panel__footer .base-button')].find((button) =>
    button.textContent?.includes('Clear all'),
  )

const boundInput = (key: string, bound: 'from' | 'to') =>
  document.querySelector<HTMLInputElement>(`[id$="-${key}-${bound}"]`)!
const textInput = (key: string) => document.querySelector<HTMLInputElement>(`[id$="-${key}"]`)!

const lastFilters = (wrapper: TPanel) =>
  wrapper.emitted('update:filters')?.at(-1)?.[0] as TRecordFilterValues | undefined

/** Fake timers only for the wait: around a `mountSuspended` they would stall the mount. */
async function typeInto(element: HTMLInputElement, value: string) {
  vi.useFakeTimers()

  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()

  vi.advanceTimersByTime(300)
  vi.useRealTimers()

  await nextTick()
  await nextTick()
}

describe('RecordsFilterPanel', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    const root = document.createElement('div')
    root.id = '__nuxt'
    document.body.appendChild(root)

    setActivePinia(useNuxtApp().$pinia as Pinia)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('which columns get a control', () => {
    it('is a drawer titled Filters', async () => {
      await panel()

      expect(drawer()).not.toBeNull()
      expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Filters')
    })

    it('brackets the table’s fields with the record’s own columns', async () => {
      await panel()

      expect(labels()).toEqual([
        'Record #',
        'Company',
        'Salary',
        'Active',
        'Created at',
        'Updated at',
      ])
    })

    it('still offers the record’s own columns for a table with no fields', async () => {
      await panel({ fields: [] })

      expect(labels()).toEqual(['Record #', 'Created at', 'Updated at'])
    })

    it('offers no control for a field whose filter could not round-trip', async () => {
      await panel({
        fields: [
          textField('search', { name: 'Search' }),
          textField('company', { name: 'Company' }),
        ],
      })

      expect(labels()).not.toContain('Search')
      expect(labels()).toContain('Company')
    })

    it('renders one control per column', async () => {
      await panel()

      expect(controls()).toHaveLength(6)
    })

    it('suffixes every control id with its field key, under one panel prefix', async () => {
      await panel({ fields: [textField('company')] })

      const id = textInput('company').id
      expect(id).toMatch(/^.+-company$/)
      expect(id).not.toBe('company')
    })
  })

  describe('showing the current filters', () => {
    it('shows an unfiltered TEXT column as an empty box', async () => {
      await panel({ fields: [textField('company')] })

      expect(textInput('company').value).toBe('')
    })

    it('shows an unfiltered range as two empty bounds', async () => {
      await panel({ fields: [numberField('salary')] })

      expect(boundInput('salary', 'from').value).toBe('')
      expect(boundInput('salary', 'to').value).toBe('')
    })

    it('shows an active TEXT filter', async () => {
      await panel({
        fields: [textField('company')],
        filters: { company: 'acme' },
      })

      expect(textInput('company').value).toBe('acme')
    })

    it('shows an active range on the bound it was set on', async () => {
      await panel({
        fields: [numberField('salary')],
        filters: { salary: { from: 1000, to: null } },
      })

      expect(boundInput('salary', 'from').value).toBe('1000')
      expect(boundInput('salary', 'to').value).toBe('')
    })

    it('shows a multi SELECT’s selection as its first value and a count', async () => {
      await panel({
        fields: [asMultiple(selectField(['Won', 'Lost']))],
        filters: { stage: ['Won', 'Lost'] },
      })

      expect(document.querySelector('.base-select__value .base-badge')?.textContent?.trim()).toBe(
        'Won',
      )
      expect(document.querySelector('.base-select__more')?.textContent?.trim()).toBe('+1')
    })
  })

  describe('changing a filter', () => {
    it('emits the new value under its field key', async () => {
      const wrapper = await panel({ fields: [textField('company')] })

      await typeInto(textInput('company'), 'acme')

      expect(lastFilters(wrapper)).toEqual({ company: 'acme' })
    })

    it('keeps every other active filter', async () => {
      const wrapper = await panel({ filters: { company: 'acme' } })

      await typeInto(boundInput('salary', 'from'), '1000')

      expect(lastFilters(wrapper)).toEqual({
        company: 'acme',
        salary: { from: 1000, to: null },
      })
    })

    it('drops a filter cleared back to empty', async () => {
      const wrapper = await panel({ filters: { company: 'acme', active: true } })

      await typeInto(textInput('company'), '')

      expect(lastFilters(wrapper)).toEqual({ active: true })
    })

    it('drops a range whose only bound was cleared', async () => {
      const wrapper = await panel({ filters: { salary: { from: 1000, to: null } } })

      await typeInto(boundInput('salary', 'from'), '')

      expect(lastFilters(wrapper)).toEqual({})
    })

    it('emits keys in column order, whichever control was touched', async () => {
      const wrapper = await panel({ filters: { active: true } })

      await typeInto(textInput('company'), 'acme')

      expect(Object.keys(lastFilters(wrapper)!)).toEqual(['company', 'active'])
    })

    it('lets a record’s own column be filtered like any other', async () => {
      const wrapper = await panel()

      await typeInto(textInput(RECORD_NUMBER_KEY), '4')

      expect(lastFilters(wrapper)).toEqual({ [RECORD_NUMBER_KEY]: '4' })
    })

    it('filters a timestamp as a range', async () => {
      const wrapper = await panel()

      await typeInto(boundInput(CREATED_AT_KEY, 'from'), '2026-01-05')

      expect(lastFilters(wrapper)).toEqual({ [CREATED_AT_KEY]: { from: '2026-01-05', to: null } })
    })
  })

  describe('the BOOLEAN adapters', () => {
    const checked = () =>
      document.querySelector('[role="radiogroup"] [aria-checked="true"]')?.textContent?.trim()

    it('shows an unfiltered boolean as All', async () => {
      await panel({ fields: [booleanField('active', { name: 'Active' })] })

      expect(checked()).toBe('All')
    })

    it.each([
      [true, 'Yes'],
      [false, 'No'],
    ])('shows a filtered %s as its word', async (value, label) => {
      await panel({
        fields: [booleanField('active', { name: 'Active' })],
        filters: { active: value },
      })

      expect(checked()).toBe(label)
    })

    it('emits a real boolean when a choice is picked', async () => {
      const wrapper = await panel({ fields: [booleanField('active', { name: 'Active' })] })

      const yes = [...document.querySelectorAll<HTMLElement>('[role="radio"]')].find(
        (segment) => segment.textContent?.trim() === 'Yes',
      )
      yes?.click()
      await wrapper.vm.$nextTick()

      expect(lastFilters(wrapper)).toEqual({ active: true })
    })

    it('drops the filter when All is picked again', async () => {
      const wrapper = await panel({
        fields: [booleanField('active', { name: 'Active' })],
        filters: { active: true },
      })

      const all = [...document.querySelectorAll<HTMLElement>('[role="radio"]')].find(
        (segment) => segment.textContent?.trim() === 'All',
      )
      all?.click()
      await wrapper.vm.$nextTick()

      expect(lastFilters(wrapper)).toEqual({})
    })
  })

  describe('the footer', () => {
    it('counts the matching records', async () => {
      await panel({ total: 12 })

      expect(count()).toBe('12 matching records')
    })

    it('reads singular at one and plural at zero', async () => {
      const one = await panel({ total: 1 })
      expect(count()).toBe('1 matching record')
      one.unmount()

      await panel({ total: 0 })
      expect(count()).toBe('0 matching records')
    })

    it('says it is filtering rather than showing a stale count', async () => {
      await panel({ total: 12, pending: true })

      expect(count()).toBe('Filtering…')
    })

    it('offers Clear all only when something is filtered', async () => {
      const empty = await panel()
      expect(clearAll()).toBeUndefined()
      empty.unmount()

      await panel({ filters: { company: 'acme' } })
      expect(clearAll()).toBeDefined()
    })

    it('clears every filter at once', async () => {
      const wrapper = await panel({ filters: { company: 'acme', active: true } })

      clearAll()?.click()

      expect(lastFilters(wrapper)).toEqual({})
    })
  })

  it('closes from its Done button', async () => {
    const wrapper = await panel({ filters: { company: 'acme' } })

    const done = [...document.querySelectorAll<HTMLElement>('.filter-panel__footer button')].find(
      (button) => button.textContent?.trim() === 'Done',
    )
    done?.click()

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('update:filters')).toBeUndefined()
  })

  it('opens with a line saying every filter must match', async () => {
    await panel()

    expect(document.querySelector('.filter-panel__intro')?.textContent).toContain(
      'match every filter',
    )
  })

  it('closes from the drawer', async () => {
    const wrapper = await panel()

    document.querySelector<HTMLElement>('[aria-label="Close"]')?.click()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
