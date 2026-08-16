import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountTracked, unmountAll } from '~~/test/mount'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { CREATED_AT_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecord } from '#shared/types/record'
import { RECORD_NUMBER_FIELD } from '#shared/utils/filter'
import RecordFieldValue from '~/components/records/RecordFieldValue.vue'
import MultiValueCell from '~/field-types/cells/MultiValueCell.vue'
import { useRelationsStore } from '~/stores/relations'
import {
  asMultiple,
  booleanField,
  dateField,
  numberField,
  record,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

const createdAtColumn: IField = { ...RECORD_NUMBER_FIELD, key: CREATED_AT_KEY, name: 'Created at' }

function cell(column: IField, row: IRecord = record()) {
  return mountTracked(RecordFieldValue, { props: { record: row, column } })
}

/** A row carrying one value under the column's own key. */
function rowWith(column: IField, value: unknown): IRecord {
  return record({ data: { [column.key]: value } as IRecord['data'] })
}

describe('RecordFieldValue', () => {
  afterEach(unmountAll)

  // A RELATION cell resolves its ref through the store the Nuxt app provides, and that store
  // outlives the case — so its cache is cleared rather than re-created
  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    useRelationsStore().linkedByField = {}
  })

  /**
   * Handled here, once, so no cell component has to deal with null — which is what lets
   * `IFieldCellProps.value` stay a value rather than a value-or-absent.
   */
  describe('blank', () => {
    it('says so for a key the record does not carry', async () => {
      const wrapper = await cell(textField('company'))

      expect(wrapper.text()).toBe('Not set')
      expect(wrapper.find('.record-field-value__blank').exists()).toBe(true)
    })

    it('says so for a stored null', async () => {
      const wrapper = await cell(textField('company'), rowWith(textField('company'), null))

      expect(wrapper.text()).toBe('Not set')
    })

    /**
     * Without this a cleared multi-value field would render as nothing at all rather than
     * saying so — an empty list is as blank as a null.
     */
    it('says so for an empty list', async () => {
      const column = asMultiple(selectField())
      const wrapper = await cell(column, rowWith(column, []))

      expect(wrapper.text()).toBe('Not set')
      expect(wrapper.findComponent(MultiValueCell).exists()).toBe(false)
    })

    it('is not blank for a false', async () => {
      const column = booleanField('active')
      const wrapper = await cell(column, rowWith(column, false))

      expect(wrapper.text()).not.toBe('Not set')
      expect(wrapper.text()).toBe('No')
    })

    it('is not blank for a zero', async () => {
      const column = numberField('total')
      const wrapper = await cell(column, rowWith(column, 0))

      expect(wrapper.text()).toBe('0')
    })

    it('is not blank for an empty string, which a cell still renders', async () => {
      const column = textField('company')
      const wrapper = await cell(column, rowWith(column, ''))

      expect(wrapper.find('.record-field-value__blank').exists()).toBe(false)
    })
  })

  /**
   * Two branches, because the two cell shapes take different values: a list cell takes the
   * whole list, every other cell takes one value.
   */
  describe('which shape it renders', () => {
    it('hands a single-value column exactly one value', async () => {
      const column = textField('company')
      const wrapper = await cell(column, rowWith(column, 'Acme'))

      expect(wrapper.findComponent(MultiValueCell).exists()).toBe(false)
      expect(wrapper.text()).toBe('Acme')
    })

    it('hands a multi-value column the whole list', async () => {
      const column = asMultiple(selectField())
      const wrapper = await cell(column, rowWith(column, ['Won', 'Lost']))

      const list = wrapper.findComponent(MultiValueCell)
      expect(list.exists()).toBe(true)
      expect(list.props('value')).toEqual(['Won', 'Lost'])
    })

    /** `toCellValueList` normalises at the seam, so a pre-migration scalar still renders as a list. */
    it('normalises a bare string left over from before the field was widened', async () => {
      const column = asMultiple(selectField())
      const wrapper = await cell(column, rowWith(column, 'Won'))

      expect(wrapper.findComponent(MultiValueCell).props('value')).toEqual(['Won'])
    })

    it('renders every entry of a list', async () => {
      const column = asMultiple(selectField(['Won', 'Lost']))
      const wrapper = await cell(column, rowWith(column, ['Won', 'Lost']))

      expect(wrapper.text()).toContain('Won')
      expect(wrapper.text()).toContain('Lost')
    })
  })

  describe('per-type rendering', () => {
    it('formats a NUMBER with thousands separated', async () => {
      const column = numberField('total')
      const wrapper = await cell(column, rowWith(column, 1284))

      expect(wrapper.text().replace(/\s/g, ' ')).toBe('1,284')
    })

    it('formats a DATE for a column', async () => {
      const column = dateField('signed_on')
      const wrapper = await cell(column, rowWith(column, '2026-01-05'))

      expect(wrapper.text().replace(/\s/g, ' ')).toBe('05 Jan 2026')
    })

    it('reads a BOOLEAN as words rather than a raw value', async () => {
      const column = booleanField('active')

      expect((await cell(column, rowWith(column, true))).text()).toBe('Yes')
      expect((await cell(column, rowWith(column, false))).text()).toBe('No')
    })

    /** The same cell the detail dialog draws, so this covers both surfaces. */
    it('resolves a RELATION to its number and label through the relations store', async () => {
      const column = relationField()
      useRelationsStore().cacheLinkedRecords({
        [column.id]: { rec_ada: { number: 7, label: 'Ada Lovelace' } },
      })

      const wrapper = await cell(column, rowWith(column, 'rec_ada'))

      expect(wrapper.text()).toContain('#7 Ada Lovelace')
    })

    /** Nothing names it, so the number is the whole reference — stated once. */
    it('reads a RELATION whose target has no label as its number alone', async () => {
      const column = relationField()
      useRelationsStore().cacheLinkedRecords({
        [column.id]: { rec_blank: { number: 8, label: null } },
      })

      const wrapper = await cell(column, rowWith(column, 'rec_blank'))

      expect(wrapper.text()).toBe('#8')
    })

    it('degrades a relation whose target is gone', async () => {
      const column = relationField()
      const wrapper = await cell(column, rowWith(column, 'rec_deleted'))

      expect(wrapper.text()).toContain('Unknown record')
      // Nothing resolved, so there is no number to state either
      expect(wrapper.text()).not.toContain('#')
    })
  })

  /** A record's own columns read from the record, not from its data, and draw their own cells. */
  describe('the record’s own columns', () => {
    it('renders the record number', async () => {
      const wrapper = await cell(RECORD_NUMBER_FIELD, record({ number: 42 }))

      expect(wrapper.text()).toContain('42')
    })

    it('renders a timestamp in UTC', async () => {
      const wrapper = await cell(createdAtColumn, record())

      expect(wrapper.text().replace(/\s/g, ' ')).toBe('05 Jan 2026, 09:14')
    })
  })
})
