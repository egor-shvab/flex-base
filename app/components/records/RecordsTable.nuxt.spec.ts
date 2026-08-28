import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY, UPDATED_AT_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { IRecordSort } from '#shared/types/filter'
import type { IRecord } from '#shared/types/record'
import RecordsTable from '~/components/records/RecordsTable.vue'
import { numberField, record, selectField, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const TABLE_ID = 'tbl_deals'

const FIELDS: IField[] = [textField('company', { name: 'Company' }), numberField('total')]

const RECORDS: IRecord[] = [
  record({ id: 'rec_1', number: 1, data: { company: 'Acme', total: 1000 } }),
  record({ id: 'rec_2', number: 2, data: { company: 'Globex', total: 2000 } }),
]

function table(props: { fields?: IField[]; records?: IRecord[]; sort?: IRecordSort | null } = {}) {
  return mountTracked(RecordsTable, {
    props: {
      tableId: TABLE_ID,
      fields: props.fields ?? FIELDS,
      records: props.records ?? RECORDS,
      sort: props.sort ?? null,
    },
  })
}

type TTable = Awaited<ReturnType<typeof table>>

const headers = (wrapper: TTable) => wrapper.findAll('thead th')
const headerNames = (wrapper: TTable) => headers(wrapper).map((th) => th.text().trim())
const rows = (wrapper: TTable) => wrapper.findAll('tbody tr')

describe('RecordsTable', () => {
  afterEach(unmountAll)

  // A row's View action goes through `useDetailLink`; a RELATION cell reads the relations store
  beforeEach(() => setActivePinia(useNuxtApp().$pinia as Pinia))

  /**
   * One list drives the header and the body, so the two cannot drift — the record's own columns
   * bracket the table's fields rather than being appended anywhere convenient.
   */
  describe('columns', () => {
    it('brackets the table’s fields with the record’s own columns', async () => {
      const wrapper = await table()

      expect(headerNames(wrapper)).toEqual([
        'Record #',
        'Company',
        'total',
        'Created at',
        'Updated at',
        'Actions',
      ])
    })

    it('gives every row a cell per column', async () => {
      const wrapper = await table()

      // Five columns plus the actions cell
      expect(rows(wrapper)[0]!.findAll('td')).toHaveLength(headers(wrapper).length)
    })

    it('still renders the record’s own columns for a table with no fields of its own', async () => {
      const wrapper = await table({ fields: [] })

      expect(headerNames(wrapper)).toEqual(['Record #', 'Created at', 'Updated at', 'Actions'])
    })

    it('names every column but Actions with a scope', async () => {
      const wrapper = await table()

      expect(headers(wrapper).every((th) => th.attributes('scope') === 'col')).toBe(true)
    })
  })

  describe('rows', () => {
    it('renders one per record', async () => {
      const wrapper = await table()

      expect(rows(wrapper)).toHaveLength(2)
    })

    it('renders the header and no rows for an empty page', async () => {
      const wrapper = await table({ records: [] })

      expect(rows(wrapper)).toHaveLength(0)
      // The table never invents an empty state of its own — that belongs to the page
      expect(headers(wrapper).length).toBeGreaterThan(0)
    })

    it('draws each cell through the field-type registry', async () => {
      const wrapper = await table()

      const cells = rows(wrapper)[0]!
        .findAll('td')
        .map((td) => td.text().trim())
      expect(cells[0]).toContain('1')
      expect(cells[1]).toBe('Acme')
      expect(cells[2]!.replace(/\s/g, ' ')).toBe('1,000')
    })

    it('says so for a column the record has no value for', async () => {
      const wrapper = await table({
        fields: [...FIELDS, selectField(['Won', 'Lost'])],
        records: [record({ data: { company: 'Acme' } })],
      })

      const cells = rows(wrapper)[0]!
        .findAll('td')
        .map((td) => td.text().trim())
      expect(cells[2]).toBe('Not set')
      expect(cells[3]).toBe('Not set')
    })
  })

  describe('sorting', () => {
    it('reports no sort on every column when the view is unsorted', async () => {
      const wrapper = await table()

      expect(headers(wrapper).map((th) => th.attributes('aria-sort'))).toEqual([
        'none',
        'none',
        'none',
        'none',
        'none',
        undefined,
      ])
    })

    it('reports the direction on the sorted column alone', async () => {
      const wrapper = await table({ sort: { key: 'company', direction: 'asc' } })

      expect(headers(wrapper).map((th) => th.attributes('aria-sort'))).toEqual([
        'none',
        'ascending',
        'none',
        'none',
        'none',
        undefined,
      ])
    })

    it('reports descending too', async () => {
      const wrapper = await table({ sort: { key: 'company', direction: 'desc' } })

      expect(headers(wrapper)[1]!.attributes('aria-sort')).toBe('descending')
    })

    /** The affordance is always visible — a hover-revealed one does not exist on touch. */
    it('marks only the sorted column’s icon active', async () => {
      const wrapper = await table({ sort: { key: 'company', direction: 'asc' } })

      const active = wrapper.findAll('.records-table__sort-icon--active')
      expect(active).toHaveLength(1)
      expect(headers(wrapper)[1]!.find('.records-table__sort-icon--active').exists()).toBe(true)
    })

    it('makes every column header a sort button, the record’s own included', async () => {
      const wrapper = await table()

      // Every header but Actions carries one
      expect(wrapper.findAll('.records-table__sort')).toHaveLength(headers(wrapper).length - 1)
    })

    it.each([
      [RECORD_NUMBER_KEY, 0],
      ['company', 1],
      [CREATED_AT_KEY, 3],
      [UPDATED_AT_KEY, 4],
    ])('emits sort with the %s key', async (key, index) => {
      const wrapper = await table()

      await wrapper.findAll('.records-table__sort')[index]!.trigger('click')

      expect(wrapper.emitted('sort')).toEqual([[key]])
    })
  })

  describe('row actions', () => {
    /**
     * Reading a record is a place, not an event — so View is a real link and the row never has
     * to mediate a navigation.
     */
    it('renders View as a link addressing the record', async () => {
      const wrapper = await table()

      const view = rows(wrapper)[0]!.get('[aria-label="View record"]')
      expect(view.element.tagName).toBe('A')
      expect(view.attributes('href')).toContain(`detail=${TABLE_ID}.rec_1`)
    })

    it('addresses each row’s own record', async () => {
      const wrapper = await table()

      const hrefs = wrapper
        .findAll('[aria-label="View record"]')
        .map((link) => link.attributes('href'))

      expect(hrefs[0]).toContain('rec_1')
      expect(hrefs[1]).toContain('rec_2')
    })

    it('emits edit with the row’s record', async () => {
      const wrapper = await table()

      await rows(wrapper)[1]!.get('[aria-label="Edit record"]').trigger('click')

      expect(wrapper.emitted('edit')).toEqual([[RECORDS[1]]])
    })

    it('emits delete with the row’s record', async () => {
      const wrapper = await table()

      await rows(wrapper)[0]!.get('[aria-label="Delete record"]').trigger('click')

      expect(wrapper.emitted('delete')).toEqual([[RECORDS[0]]])
    })

    it('gives every row all three actions', async () => {
      const wrapper = await table()

      for (const row of rows(wrapper)) {
        expect(row.findAll('.records-table__actions-group > *')).toHaveLength(3)
      }
    })
  })
})
