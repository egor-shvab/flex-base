import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import RecordsFilterPanel from '~/components/records/RecordsFilterPanel.vue'
import { asMultiple, booleanField, numberField, selectField, textField } from '~~/test/fixtures'

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
    pending?: boolean
  } = {},
) {
  return mountSuspended(RecordsFilterPanel, {
    props: {
      fields: props.fields ?? FIELDS,
      filters: props.filters ?? {},
      total: props.total ?? 12,
      pending: props.pending ?? false,
    },
  })
}

type TPanel = Awaited<ReturnType<typeof panel>>

/** The panel renders inside `BaseModal`'s drawer, so everything is teleported to `<body>`. */
const drawer = () => document.querySelector<HTMLElement>('.base-modal--drawer')
const controls = () => [...document.querySelectorAll<HTMLElement>('.filter-panel > *')]
const labels = () =>
  [...document.querySelectorAll('.filter-panel label')].map((label) => label.textContent?.trim())
const count = () => document.querySelector('.filter-panel__count')?.textContent?.trim()
const clearAll = () =>
  [...document.querySelectorAll<HTMLElement>('.filter-panel__footer .base-button')].find((button) =>
    button.textContent?.includes('Clear all'),
  )

const boundInput = (key: string, bound: 'from' | 'to') =>
  document.querySelector<HTMLInputElement>(`[id$="-${key}-${bound}"]`)!
const textInput = (key: string) => document.querySelector<HTMLInputElement>(`[id$="-${key}"]`)!

/** The last filter map the panel emitted upward. */
const lastFilters = (wrapper: TPanel) =>
  wrapper.emitted('update:filters')?.at(-1)?.[0] as TRecordFilterValues | undefined

/**
 * Types into a control the way `BaseInput` reads it — raw `el.value` plus an input event — and
 * then drives the 300ms debounce every typed filter carries, since a query input must not hit
 * the API on each keystroke. Fake timers are switched on only for the wait: turning them on
 * around a `mountSuspended` would stall the mount itself.
 */
async function typeInto(element: HTMLInputElement, value: string) {
  vi.useFakeTimers()

  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  // Lets the draft watcher run and schedule the write
  await nextTick()

  vi.advanceTimersByTime(300)
  vi.useRealTimers()

  await nextTick()
  await nextTick()
}

describe('RecordsFilterPanel', () => {
  beforeEach(() => {
    // `BaseModal` marks this element inert while the drawer is open
    const root = document.createElement('div')
    root.id = '__nuxt'
    document.body.appendChild(root)

    // A RELATION filter renders `RelationFieldSelect`, which reads the relations store
    setActivePinia(useNuxtApp().$pinia as Pinia)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('which columns get a control', () => {
    it('is a drawer titled Filters', async () => {
      const wrapper = await panel()

      expect(drawer()).not.toBeNull()
      expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Filters')

      wrapper.unmount()
    })

    /** The record's own columns filter alongside the table's fields, and bracket them. */
    it('brackets the table’s fields with the record’s own columns', async () => {
      const wrapper = await panel()

      expect(labels()).toEqual([
        'Record #',
        'Company',
        'Salary',
        'Active',
        'Created at',
        'Updated at',
      ])

      wrapper.unmount()
    })

    it('still offers the record’s own columns for a table with no fields', async () => {
      const wrapper = await panel({ fields: [] })

      expect(labels()).toEqual(['Record #', 'Created at', 'Updated at'])

      wrapper.unmount()
    })

    /**
     * A control that discards what is typed into it is a dead control. A legacy field keyed
     * like a reserved param claims no query param, so its filter could never round-trip — and
     * `filterableFields` drops it here rather than offering a box that forgets.
     */
    it('offers no control for a field whose filter could not round-trip', async () => {
      const wrapper = await panel({
        fields: [
          textField('search', { name: 'Search' }),
          textField('company', { name: 'Company' }),
        ],
      })

      expect(labels()).not.toContain('Search')
      expect(labels()).toContain('Company')

      wrapper.unmount()
    })

    it('renders one control per column', async () => {
      const wrapper = await panel()

      expect(controls()).toHaveLength(6)

      wrapper.unmount()
    })

    it('suffixes every control id with its field key, under one panel prefix', async () => {
      const wrapper = await panel({ fields: [textField('company')] })

      const id = textInput('company').id
      expect(id).toMatch(/^.+-company$/)
      expect(id).not.toBe('company')

      wrapper.unmount()
    })
  })

  /** Every control is always rendered, so an unfiltered field shows its own empty value. */
  describe('showing the current filters', () => {
    it('shows an unfiltered TEXT column as an empty box', async () => {
      const wrapper = await panel({ fields: [textField('company')] })

      expect(textInput('company').value).toBe('')

      wrapper.unmount()
    })

    it('shows an unfiltered range as two empty bounds', async () => {
      const wrapper = await panel({ fields: [numberField('salary')] })

      expect(boundInput('salary', 'from').value).toBe('')
      expect(boundInput('salary', 'to').value).toBe('')

      wrapper.unmount()
    })

    it('shows an active TEXT filter', async () => {
      const wrapper = await panel({
        fields: [textField('company')],
        filters: { company: 'acme' },
      })

      expect(textInput('company').value).toBe('acme')

      wrapper.unmount()
    })

    it('shows an active range on the bound it was set on', async () => {
      const wrapper = await panel({
        fields: [numberField('salary')],
        filters: { salary: { from: 1000, to: null } },
      })

      expect(boundInput('salary', 'from').value).toBe('1000')
      expect(boundInput('salary', 'to').value).toBe('')

      wrapper.unmount()
    })

    it('shows a multi SELECT’s selection as a count', async () => {
      const wrapper = await panel({
        fields: [asMultiple(selectField(['Won', 'Lost']))],
        filters: { stage: ['Won', 'Lost'] },
      })

      expect(document.querySelector('.base-select__value')?.textContent?.trim()).toBe('2 selected')

      wrapper.unmount()
    })
  })

  /**
   * `applyFieldValue` rebuilds the whole map in column order rather than patching one key —
   * which is what keeps a shared URL stable no matter which control the user touched.
   */
  describe('changing a filter', () => {
    it('emits the new value under its field key', async () => {
      const wrapper = await panel({ fields: [textField('company')] })

      await typeInto(textInput('company'), 'acme')

      expect(lastFilters(wrapper)).toEqual({ company: 'acme' })

      wrapper.unmount()
    })

    it('keeps every other active filter', async () => {
      const wrapper = await panel({ filters: { company: 'acme' } })

      await typeInto(boundInput('salary', 'from'), '1000')

      expect(lastFilters(wrapper)).toEqual({
        company: 'acme',
        salary: { from: 1000, to: null },
      })

      wrapper.unmount()
    })

    /** A value that means "not filtered" is dropped, so the map only ever holds active ones. */
    it('drops a filter cleared back to empty', async () => {
      const wrapper = await panel({ filters: { company: 'acme', active: true } })

      await typeInto(textInput('company'), '')

      expect(lastFilters(wrapper)).toEqual({ active: true })

      wrapper.unmount()
    })

    it('drops a range whose only bound was cleared', async () => {
      const wrapper = await panel({ filters: { salary: { from: 1000, to: null } } })

      await typeInto(boundInput('salary', 'from'), '')

      expect(lastFilters(wrapper)).toEqual({})

      wrapper.unmount()
    })

    /**
     * Invisible in the values, and the whole reason the map is rebuilt rather than patched: two
     * users filtering the same columns in a different order must produce the same link.
     */
    it('emits keys in column order, whichever control was touched', async () => {
      const wrapper = await panel({ filters: { active: true } })

      await typeInto(textInput('company'), 'acme')

      expect(Object.keys(lastFilters(wrapper)!)).toEqual(['company', 'active'])

      wrapper.unmount()
    })

    it('lets a record’s own column be filtered like any other', async () => {
      const wrapper = await panel()

      await typeInto(textInput(RECORD_NUMBER_KEY), '4')

      expect(lastFilters(wrapper)).toEqual({ [RECORD_NUMBER_KEY]: '4' })

      wrapper.unmount()
    })

    it('filters a timestamp as a range', async () => {
      const wrapper = await panel()

      await typeInto(boundInput(CREATED_AT_KEY, 'from'), '2026-01-05')

      expect(lastFilters(wrapper)).toEqual({ [CREATED_AT_KEY]: { from: '2026-01-05', to: null } })

      wrapper.unmount()
    })
  })

  /** The one control whose model is a different shape from its filter value. */
  describe('the BOOLEAN adapters', () => {
    it('shows an unfiltered boolean as no choice at all', async () => {
      const wrapper = await panel({ fields: [booleanField('active', { name: 'Active' })] })

      expect(document.querySelector('.base-select__value')).toBeNull()
      expect(document.querySelector('.base-select__placeholder')?.textContent?.trim()).toBe('All')

      wrapper.unmount()
    })

    it.each([
      [true, 'Yes'],
      [false, 'No'],
    ])('shows a filtered %s as its word', async (value, label) => {
      const wrapper = await panel({
        fields: [booleanField('active', { name: 'Active' })],
        filters: { active: value },
      })

      expect(document.querySelector('.base-select__value')?.textContent?.trim()).toBe(label)

      wrapper.unmount()
    })

    it('emits a real boolean when a choice is picked', async () => {
      const wrapper = await panel({ fields: [booleanField('active', { name: 'Active' })] })

      document.querySelector<HTMLElement>('.base-select__control')?.click()
      await wrapper.vm.$nextTick()
      const yes = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) =>
        option.textContent?.includes('Yes'),
      )
      yes?.click()
      await wrapper.vm.$nextTick()

      expect(lastFilters(wrapper)).toEqual({ active: true })

      wrapper.unmount()
    })
  })

  describe('the footer', () => {
    it('counts the matching records', async () => {
      const wrapper = await panel({ total: 12 })

      expect(count()).toBe('12 matching records')

      wrapper.unmount()
    })

    it('reads singular at one and plural at zero', async () => {
      const one = await panel({ total: 1 })
      expect(count()).toBe('1 matching record')
      one.unmount()

      const none = await panel({ total: 0 })
      expect(count()).toBe('0 matching records')
      none.unmount()
    })

    /** A stale count under a filter being applied would be a lie. */
    it('says it is filtering rather than showing a stale count', async () => {
      const wrapper = await panel({ total: 12, pending: true })

      expect(count()).toBe('Filtering…')

      wrapper.unmount()
    })

    /** Never a dead control: with nothing filtered there is nothing to clear. */
    it('offers Clear all only when something is filtered', async () => {
      const empty = await panel()
      expect(clearAll()).toBeUndefined()
      empty.unmount()

      const filtered = await panel({ filters: { company: 'acme' } })
      expect(clearAll()).toBeDefined()
      filtered.unmount()
    })

    it('clears every filter at once', async () => {
      const wrapper = await panel({ filters: { company: 'acme', active: true } })

      clearAll()?.click()

      expect(lastFilters(wrapper)).toEqual({})

      wrapper.unmount()
    })
  })

  it('closes from the drawer', async () => {
    const wrapper = await panel()

    document.querySelector<HTMLElement>('[aria-label="Close"]')?.click()

    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })
})
