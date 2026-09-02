import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useNuxtApp } from '#imports'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import type { ITableListItem } from '#shared/types/table'
import RelationFieldCell from '~/field-types/relation/RelationFieldCell.vue'
import { useRelationsStore } from '~/stores/relations'
import { useTablesStore } from '~/stores/tables'
import { relationField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

/**
 * A relation stores its target's **id**, but a link has to carry an address — so the cell reads
 * the target table's number out of the tables store. What is pinned here is the seam between the
 * two, and above all that a number the store cannot supply degrades to text rather than to a
 * link pointing nowhere.
 */
/** The fixture already targets `tbl_people`; naming it here is what the store is keyed on. */
const TARGET_TABLE_ID = 'tbl_people'
const field = relationField({ targetTableId: TARGET_TABLE_ID, labelFieldKey: 'full_name' })

function targetTable(number: number): ITableListItem {
  return {
    id: TARGET_TABLE_ID,
    number,
    name: 'People',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { fields: 0, records: 0 },
  }
}

function mountCell() {
  return mountTracked(RelationFieldCell, { props: { field, value: 'rec_ada' } })
}

describe('RelationFieldCell', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)

    const relations = useRelationsStore()
    relations.linkedByField = { [field.id]: { rec_ada: { number: 7, label: 'Ada' } } }
    useTablesStore().tables = []
  })

  it('links to the target record by both numbers, never by an id', async () => {
    useTablesStore().tables = [targetTable(2)]

    const wrapper = await mountCell()
    const link = wrapper.get('a')

    expect(link.attributes('href')).toContain('detail=2.7')
    expect(link.attributes('href')).not.toContain('rec_ada')
    expect(link.attributes('href')).not.toContain(TARGET_TABLE_ID)
  })

  /**
   * `ensureTables` never throws, so the list may legitimately be empty — and then the target's
   * number is unknowable. Falling back to text is the same degradation a deleted target already
   * gets; rendering a link built from a missing number would point at nothing.
   */
  it('falls back to plain text when the target table’s number is unknown', async () => {
    const wrapper = await mountCell()

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ada')
  })
})
