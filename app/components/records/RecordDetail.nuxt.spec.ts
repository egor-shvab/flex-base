import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import RecordDetail from '~/components/records/RecordDetail.vue'
import { recordWithAuthors, relationField, selectField, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const terms = (wrapper: { findAll: (selector: string) => { text: () => string }[] }) =>
  wrapper.findAll('.record-detail__term').map((term) => term.text())

const FIELDS = [textField('company', { name: 'Company' }), selectField()]

describe('RecordDetail', () => {
  afterEach(unmountAll)

  beforeEach(() => setActivePinia(useNuxtApp().$pinia as Pinia))

  it('brackets the table’s own fields with the record’s columns and its authors', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: FIELDS, record: recordWithAuthors() },
    })

    expect(terms(wrapper)).toEqual([
      'Company',
      'stage',
      'Created at',
      'Updated at',
      'Created by',
      'Updated by',
    ])
  })

  it('leaves out the record number, which the heading already carries', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: FIELDS, record: recordWithAuthors() },
    })

    const keys = wrapper.findAll('.record-detail__row').length

    expect(terms(wrapper)).not.toContain('Record #')
    expect(keys).toBe(6)
  })

  it('renders a table with no fields as its record columns and authors alone', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: [], record: recordWithAuthors() },
    })

    expect(terms(wrapper)).toEqual(['Created at', 'Updated at', 'Created by', 'Updated by'])
  })

  it('includes a relation without knowing what it is', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: [...FIELDS, relationField()], record: recordWithAuthors() },
    })

    expect(terms(wrapper)).toContain('owner')
  })

  it('pairs every term with exactly one value', async () => {
    const wrapper = await mountTracked(RecordDetail, {
      props: { fields: FIELDS, record: recordWithAuthors({ data: { company: 'Acme' } }) },
    })

    expect(wrapper.findAll('.record-detail__value')).toHaveLength(terms(wrapper).length)
    expect(wrapper.text()).toContain('Acme')
  })
})
