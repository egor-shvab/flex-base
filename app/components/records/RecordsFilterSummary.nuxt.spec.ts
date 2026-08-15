import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import RecordsFilterSummary from '~/components/records/RecordsFilterSummary.vue'
import { useRelationsStore } from '~/stores/relations'
import { numberField, relationField, selectField, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const COMPANY = textField('company', { name: 'Company' })
const VALUE = numberField('contract_value', { name: 'Contract value' })
const STAGE = selectField(['Won', 'Lost'], { key: 'stage', name: 'Stage' })
const OWNER = relationField({}, { id: 'fld_owner', key: 'owner', name: 'Owner' })

async function summary(
  filters: TRecordFilterValues,
  overrides: { fields?: IField[]; search?: string; total?: number; pending?: boolean } = {},
) {
  return mountTracked(RecordsFilterSummary, {
    props: {
      fields: overrides.fields ?? [COMPANY, VALUE, STAGE, OWNER],
      filters,
      search: overrides.search ?? '',
      total: overrides.total ?? 12,
      pending: overrides.pending ?? false,
    },
  })
}

/** The chips as rendered, `Field` label first — enough to assert order and phrasing at once. */
function chips(wrapper: Awaited<ReturnType<typeof summary>>): string[] {
  return wrapper
    .findAll('.filter-summary__chip')
    .map((chip) => chip.text().replace(/\s+/g, ' ').trim())
}

describe('RecordsFilterSummary', () => {
  afterEach(unmountAll)

  /**
   * The mounted component resolves `useRelationsStore()` through the pinia `@pinia/nuxt`
   * provided to the Nuxt app — not through whatever `createPinia()` a spec makes for itself.
   * Making that one active is what lets a test seed the same store the component will read.
   */
  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    // That store outlives the case, so its cache is cleared rather than re-created
    useRelationsStore().refsByField = {}
  })

  describe('the chips it builds from the registry', () => {
    it('phrases a TEXT filter as a contains', async () => {
      const wrapper = await summary({ company: 'acme' })

      expect(chips(wrapper)).toEqual(['Company contains acme'])
    })

    it('phrases a NUMBER range with inclusive wording', async () => {
      const wrapper = await summary({ contract_value: { from: 1000, to: 5000 } })

      expect(chips(wrapper)).toEqual(['Contract value between 1,000 and 5,000'])
    })

    it('phrases a half-open range as a single bound', async () => {
      const wrapper = await summary({ contract_value: { from: 1000, to: null } })

      expect(chips(wrapper)).toEqual(['Contract value 1,000 or more'])
    })

    it('phrases one choice as an equality and several as an any-of', async () => {
      expect(chips(await summary({ stage: ['Won'] }))).toEqual(['Stage is Won'])
      expect(chips(await summary({ stage: ['Won', 'Lost'] }))).toEqual([
        'Stage is any of Won, Lost',
      ])
    })

    /** The one summariser needing state beyond its own value. */
    it('resolves a RELATION filter through the relations store', async () => {
      useRelationsStore().cacheRefs({
        fld_owner: { rec_ada: { number: 7, label: 'Ada Lovelace' } },
      })

      const wrapper = await summary({ owner: 'rec_ada' })

      // Flat, unlike a cell: a chip's phrase is a string by contract, so there is nothing
      // to style the number apart from
      expect(chips(wrapper)).toEqual(['Owner is #7 Ada Lovelace'])
    })

    it('degrades a relation id it cannot resolve rather than showing the id', async () => {
      const wrapper = await summary({ owner: 'rec_missing' })

      expect(chips(wrapper)).toEqual(['Owner is Unknown record'])
    })

    /**
     * Walked in field order rather than over `Object.entries(filters)`, which would surface a
     * key with no field to pair it with — and would order chips by however the URL was written.
     */
    it('renders chips in field order, not filter-map order', async () => {
      const wrapper = await summary({ stage: ['Won'], company: 'acme' })

      expect(chips(wrapper)).toEqual(['Company contains acme', 'Stage is Won'])
    })

    it('ignores a filter key with no matching field', async () => {
      const wrapper = await summary({ company: 'acme', ghost_column: 'whatever' })

      expect(chips(wrapper)).toEqual(['Company contains acme'])
    })

    it('chips the record’s own columns alongside a table’s fields', async () => {
      const wrapper = await summary({ [CREATED_AT_KEY]: { from: '2026-01-01', to: null } })

      expect(chips(wrapper)).toEqual(['Created at from 1 Jan 2026'])
    })

    /** `queryFields` fixes where each one sits: the number leads, the timestamps trail. */
    it('places the record’s own columns around a table’s own fields', async () => {
      const wrapper = await summary({
        [RECORD_NUMBER_KEY]: '4',
        company: 'acme',
        [CREATED_AT_KEY]: { from: '2026-01-01', to: null },
      })

      expect(chips(wrapper)).toEqual([
        'Record # contains 4',
        'Company contains acme',
        'Created at from 1 Jan 2026',
      ])
    })
  })

  describe('search', () => {
    /** Not a filter, but it narrows the same list — the one deliberate special case. */
    it('states the search in the same place as the filters', async () => {
      const wrapper = await summary({ company: 'acme' }, { search: 'lovelace' })

      expect(chips(wrapper)).toEqual(['Search lovelace', 'Company contains acme'])
    })

    it('shows no search chip when nothing is searched', async () => {
      const wrapper = await summary({ company: 'acme' })

      expect(chips(wrapper)).toEqual(['Company contains acme'])
    })

    it('clears only the search from its own remove button', async () => {
      const wrapper = await summary({ company: 'acme' }, { search: 'lovelace' })

      await wrapper.get('[aria-label="Clear the search"]').trigger('click')

      expect(wrapper.emitted('update:search')).toEqual([['']])
      expect(wrapper.emitted('update:filters')).toBeUndefined()
    })
  })

  describe('the count', () => {
    it('reads singular at one match', async () => {
      const wrapper = await summary({ company: 'acme' }, { total: 1 })

      expect(wrapper.get('.filter-summary__count').text()).toBe('Showing 1 matching record:')
    })

    it('reads plural otherwise, including at zero', async () => {
      expect((await summary({}, { total: 0 })).get('.filter-summary__count').text()).toBe(
        'Showing 0 matching records:',
      )
      expect((await summary({}, { total: 12 })).get('.filter-summary__count').text()).toBe(
        'Showing 12 matching records:',
      )
    })

    /** A stale count under a new filter would be a lie, so pending states itself instead. */
    it('says it is filtering rather than showing a stale count', async () => {
      const wrapper = await summary({ company: 'acme' }, { total: 12, pending: true })

      expect(wrapper.get('.filter-summary__count').text()).toBe('Filtering…')
    })
  })

  describe('removing a filter', () => {
    it('emits the map without the removed key', async () => {
      const wrapper = await summary({ company: 'acme', stage: ['Won'] })

      await wrapper.get('[aria-label="Remove the Company filter"]').trigger('click')

      expect(wrapper.emitted('update:filters')).toEqual([[{ stage: ['Won'] }]])
    })

    it('drops every empty value, not just the removed one', async () => {
      const wrapper = await summary({
        company: 'acme',
        stage: [],
        contract_value: { from: null, to: null },
      })

      await wrapper.get('[aria-label="Remove the Company filter"]').trigger('click')

      expect(wrapper.emitted('update:filters')).toEqual([[{}]])
    })

    it('names the field in the remove button, so the label is unambiguous', async () => {
      const wrapper = await summary({ company: 'acme', stage: ['Won'] })

      const labels = wrapper
        .findAll('.filter-summary__remove')
        .map((button) => button.attributes('aria-label'))

      expect(labels).toEqual(['Remove the Company filter', 'Remove the Stage filter'])
    })
  })

  it('clears filters and search together in one navigation', async () => {
    const wrapper = await summary({ company: 'acme' }, { search: 'lovelace' })

    await wrapper.get('.base-button').trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('update:filters')).toBeUndefined()
    expect(wrapper.emitted('update:search')).toBeUndefined()
  })
})
