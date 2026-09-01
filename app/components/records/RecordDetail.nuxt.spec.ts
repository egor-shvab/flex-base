import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import RecordDetail from '~/components/records/RecordDetail.vue'
import { record, relationField, selectField, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

/**
 * The dialog's body: the same columns `RecordsTable` renders, as a definition list. Nothing
 * branches on field type, so what is worth pinning is the column *set* — the one thing that
 * could silently disagree with the row the dialog was opened from.
 */
const terms = (wrapper: { findAll: (selector: string) => { text: () => string }[] }) =>
  wrapper.findAll('.record-detail__term').map((term) => term.text())

const FIELDS = [textField('company', { name: 'Company' }), selectField()]

describe('RecordDetail', () => {
  afterEach(unmountAll)

  beforeEach(() => setActivePinia(useNuxtApp().$pinia as Pinia))

  it('brackets the table’s own fields with the record’s columns', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: FIELDS, record: record() },
    })

    // `queryColumns` order, which is what `RecordsTable` renders too
    expect(terms(wrapper)).toEqual(['Company', 'stage', 'Created at', 'Updated at'])
  })

  /** By key, not type: the dialog's heading already names the record. */
  it('leaves out the record number, which the heading already carries', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: FIELDS, record: record() },
    })

    const keys = wrapper.findAll('.record-detail__row').length

    expect(terms(wrapper)).not.toContain('Record #')
    expect(keys).toBe(4)
  })

  it('renders a table with no fields as its record columns alone', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: [], record: record() },
    })

    expect(terms(wrapper)).toEqual(['Created at', 'Updated at'])
  })

  /** A relation is a column like any other here — the cell resolves it, this does not. */
  it('includes a relation without knowing what it is', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: [...FIELDS, relationField()], record: record() },
    })

    expect(terms(wrapper)).toContain('owner')
  })

  it('pairs every term with exactly one value', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: FIELDS, record: record({ data: { company: 'Acme' } }) },
    })

    expect(wrapper.findAll('.record-detail__value')).toHaveLength(terms(wrapper).length)
    expect(wrapper.text()).toContain('Acme')
  })
})
