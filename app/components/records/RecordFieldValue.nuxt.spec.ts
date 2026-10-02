import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountTracked, unmountAll } from '~~/test/mount'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import type { IField } from '#shared/types/field'
import type { IRecord } from '#shared/types/record'
import RecordFieldValue from '~/components/records/RecordFieldValue.vue'
import MultiValueCell from '~/field-types/cells/MultiValueCell.vue'
import { useRelationsStore } from '~/stores/relations'
import {
  asMultiple,
  booleanField,
  createdAtColumn,
  dateField,
  numberField,
  record,
  recordNumberColumn,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

function cell(column: IField, row: IRecord = record()) {
  return mountTracked(RecordFieldValue, { props: { record: row, column } })
}

function blankName(wrapper: Awaited<ReturnType<typeof cell>>) {
  return wrapper.find('.record-field-value__blank .visually-hidden').text()
}

function rowWith(column: IField, value: unknown): IRecord {
  return record({ data: { [column.key]: value } as IRecord['data'] })
}

describe('RecordFieldValue', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    useRelationsStore().linkedByField = {}
  })

  describe('blank', () => {
    it('says so for a key the record does not carry', async () => {
      const wrapper = await cell(textField('company'))

      expect(blankName(wrapper)).toBe('Not set')
    })

    it('draws a dash that the accessibility tree does not see', async () => {
      const wrapper = await cell(textField('company'))
      const dash = wrapper.get('.record-field-value__blank [aria-hidden="true"]')

      expect(dash.text()).toBe('—')
    })

    it('says so for a stored null', async () => {
      const wrapper = await cell(textField('company'), rowWith(textField('company'), null))

      expect(blankName(wrapper)).toBe('Not set')
    })

    it('says so for an empty list', async () => {
      const column = asMultiple(selectField())
      const wrapper = await cell(column, rowWith(column, []))

      expect(blankName(wrapper)).toBe('Not set')
      expect(wrapper.findComponent(MultiValueCell).exists()).toBe(false)
    })

    it('is not blank for a false', async () => {
      const column = booleanField('active')
      const wrapper = await cell(column, rowWith(column, false))

      expect(wrapper.find('.record-field-value__blank').exists()).toBe(false)
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

    it('resolves a RELATION to its number and label through the relations store', async () => {
      const column = relationField()
      useRelationsStore().cacheLinkedRecords({
        [column.id]: { rec_ada: { number: 7, label: 'Ada Lovelace' } },
      })

      const wrapper = await cell(column, rowWith(column, 'rec_ada'))

      expect(wrapper.text()).toContain('#7 Ada Lovelace')
    })

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
      expect(wrapper.text()).not.toContain('#')
    })
  })

  describe('the record’s own columns', () => {
    it('renders the record number', async () => {
      const wrapper = await cell(recordNumberColumn, record({ number: 42 }))

      expect(wrapper.text()).toContain('42')
    })

    it('renders a timestamp in UTC', async () => {
      const wrapper = await cell(createdAtColumn, record())

      expect(wrapper.text().replace(/\s/g, ' ')).toBe('05 Jan 2026, 09:14')
    })
  })
})
