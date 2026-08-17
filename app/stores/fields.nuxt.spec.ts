import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IField } from '#shared/types/field'
import { fieldInputSchema } from '#shared/validation/field'
import { useFieldsStore } from '~/stores/fields'
import { useTablesStore } from '~/stores/tables'
import { numberField, textField } from '~~/test/fixtures'

const COMPANY = textField('company', { name: 'Company' })
const TOTAL = numberField('total', { name: 'Total' })

/** What each stubbed route answers with, reassigned per case. */
let listing: IField[] = []
let created: IField = COMPANY
let updated: IField = COMPANY
let shouldFail = false

/** The list row the count-moving endpoints answer with — what the store applies verbatim. */
function tableRow(counts: { fields: number; records: number }) {
  return {
    id: 'tbl_1',
    name: 'Deals',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: counts,
  }
}

registerEndpoint('/api/tables/tbl_1/fields', {
  method: 'GET',
  handler: () => {
    if (shouldFail) throw createError({ statusCode: 404, statusMessage: 'No such table' })
    return { fields: listing }
  },
})

registerEndpoint('/api/tables/tbl_1/fields', {
  method: 'POST',
  handler: () => ({ field: created, table: tableRow({ fields: 3, records: 7 }) }),
})

registerEndpoint('/api/tables/tbl_1/fields/fld_company', {
  method: 'PATCH',
  handler: () => ({ field: updated }),
})

registerEndpoint('/api/tables/tbl_1/fields/fld_company', {
  method: 'DELETE',
  handler: () => ({ ok: true, table: tableRow({ fields: 1, records: 7 }) }),
})

/**
 * The tables store's own list, so a write can be seen replacing the cached row the dashboard
 * draws its `_count` from. Registered here because `registerEndpoint` is per file.
 */
registerEndpoint('/api/tables', {
  method: 'GET',
  handler: () => ({ tables: [tableRow({ fields: 2, records: 7 })] }),
})

/** The tables store loaded, so a bump has something to land on. */
async function loadedTables() {
  const tables = useTablesStore()
  await tables.fetchTables()

  return tables
}

/**
 * Built through the schema rather than by hand: `TFieldInput` is the schema's *output*, so
 * every default is required on the type, and this is exactly the shape `useForm` hands over.
 */
const INPUT = fieldInputSchema.parse({ name: 'Company', type: 'TEXT' })

describe('useFieldsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listing = [COMPANY, TOTAL]
    created = textField('notes', { name: 'Notes' })
    updated = textField('company', { name: 'Renamed' })
    shouldFail = false
  })

  it('starts with no fields', () => {
    expect(useFieldsStore().fields).toEqual([])
  })

  it('replaces the list on fetch', async () => {
    const store = useFieldsStore()

    await store.fetchFields('tbl_1')

    expect(store.fields).toEqual([COMPANY, TOTAL])
  })

  /** Unlike `ensureTables`, nothing here is called from a place with no error boundary. */
  it('lets a failed fetch reject', async () => {
    shouldFail = true
    const store = useFieldsStore()

    await expect(store.fetchFields('tbl_1')).rejects.toThrow()
  })

  it('appends a created field', async () => {
    const store = useFieldsStore()
    await store.fetchFields('tbl_1')

    await store.createField('tbl_1', INPUT)

    expect(store.fields).toHaveLength(3)
    expect(store.fields.at(-1)).toEqual(created)
  })

  it('swaps an updated field in place and leaves its neighbours alone', async () => {
    const store = useFieldsStore()
    await store.fetchFields('tbl_1')

    await store.updateField('tbl_1', 'fld_company', INPUT)

    expect(store.fields).toEqual([updated, TOTAL])
  })

  it('removes only the deleted field', async () => {
    const store = useFieldsStore()
    await store.fetchFields('tbl_1')

    await store.deleteField('tbl_1', 'fld_company')

    expect(store.fields).toEqual([TOTAL])
  })

  /**
   * The dashboard's field count arrives with the table list and nothing refetches it, so this
   * store is the only thing that can say it moved — the same contract the records store has for
   * the count beside it.
   */
  /** Received from the endpoint, not derived — the store applies the row it was handed. */
  describe('the cached field count', () => {
    it('goes up on a create', async () => {
      const tables = await loadedTables()
      const store = useFieldsStore()

      await store.createField('tbl_1', INPUT)

      expect(tables.tables[0]?._count).toEqual({ fields: 3, records: 7 })
    })

    it('goes down on a delete', async () => {
      const tables = await loadedTables()
      const store = useFieldsStore()

      await store.deleteField('tbl_1', 'fld_company')

      expect(tables.tables[0]?._count).toEqual({ fields: 1, records: 7 })
    })

    it('does not move on an edit', async () => {
      const tables = await loadedTables()
      const store = useFieldsStore()

      await store.updateField('tbl_1', 'fld_company', INPUT)

      expect(tables.tables[0]?._count).toEqual({ fields: 2, records: 7 })
    })
  })

  /**
   * `shallowRef` is what makes the form and the table re-render, and it only tracks a whole
   * new array — an in-place splice would update the data and paint nothing.
   */
  it.each([
    [
      'createField',
      (store: ReturnType<typeof useFieldsStore>) => store.createField('tbl_1', INPUT),
    ],
    [
      'updateField',
      (store: ReturnType<typeof useFieldsStore>) =>
        store.updateField('tbl_1', 'fld_company', INPUT),
    ],
    [
      'deleteField',
      (store: ReturnType<typeof useFieldsStore>) => store.deleteField('tbl_1', 'fld_company'),
    ],
  ])('replaces the array rather than mutating it in %s', async (_name, act) => {
    const store = useFieldsStore()
    await store.fetchFields('tbl_1')
    const before = store.fields

    await act(store)

    expect(store.fields).not.toBe(before)
    expect(before).toEqual([COMPANY, TOTAL])
  })
})
