import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IField } from '#shared/types/field'
import { fieldSchema } from '#shared/validation/field'
import { useFieldsStore } from '~/stores/fields'
import { numberField, textField } from '~~/test/fixtures'

const COMPANY = textField('company', { name: 'Company' })
const TOTAL = numberField('total', { name: 'Total' })

/** What each stubbed route answers with, reassigned per case. */
let listing: IField[] = []
let created: IField = COMPANY
let updated: IField = COMPANY
let shouldFail = false

registerEndpoint('/api/tables/tbl_1/fields', {
  method: 'GET',
  handler: () => {
    if (shouldFail) throw createError({ statusCode: 404, statusMessage: 'No such table' })
    return { fields: listing }
  },
})

registerEndpoint('/api/tables/tbl_1/fields', {
  method: 'POST',
  handler: () => ({ field: created }),
})

registerEndpoint('/api/tables/tbl_1/fields/fld_company', {
  method: 'PATCH',
  handler: () => ({ field: updated }),
})

registerEndpoint('/api/tables/tbl_1/fields/fld_company', {
  method: 'DELETE',
  handler: () => ({ ok: true }),
})

/**
 * Built through the schema rather than by hand: `TFieldInput` is the schema's *output*, so
 * every default is required on the type, and this is exactly the shape `useForm` hands over.
 */
const INPUT = fieldSchema.parse({ name: 'Company', type: 'TEXT' })

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
