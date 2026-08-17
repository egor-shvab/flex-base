import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import { createError } from 'h3'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { defineComponent, h } from 'vue'
import type { ITable } from '#shared/types/table'
import { useTableLoader } from '~/composables/useTableLoader'
import { useFieldsStore } from '~/stores/fields'
import { textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const TABLE: ITable = {
  id: 'tbl_deals',
  name: 'Deals',
  createdAt: '2026-01-05T09:14:00.000Z',
  updatedAt: '2026-01-05T09:14:00.000Z',
}

/** The order each endpoint was hit in, so the two can be asserted to run together. */
const requests: string[] = []
let tableFails = false

registerEndpoint('/api/tables/tbl_deals', () => {
  requests.push('table')
  if (tableFails) throw createError({ statusCode: 404, statusMessage: 'Table not found' })
  return { table: TABLE }
})

registerEndpoint('/api/tables/tbl_deals/fields', () => {
  requests.push('fields')
  return { fields: [textField('company')] }
})

/**
 * `useApi()` wraps `useRequestFetch()`, which has to be called during setup — so the composable is
 * exercised through a mounted host rather than called bare, the same seam the other composable
 * specs use.
 */
async function load(tableId = 'tbl_deals') {
  let loader: ReturnType<typeof useTableLoader> | undefined

  await mountTracked(
    defineComponent({
      setup() {
        loader = useTableLoader()
        return () => h('div')
      },
    }),
  )

  return loader!(tableId)
}

describe('useTableLoader', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    useFieldsStore().fields = []
    requests.length = 0
    tableFails = false
  })

  it('answers with the table itself, not the response envelope', async () => {
    expect(await load()).toEqual(TABLE)
  })

  /** Both screens need both before they can draw anything, so neither waits on the other. */
  it('fetches the table and its fields together', async () => {
    await load()

    expect(requests).toHaveLength(2)
    expect(requests).toContain('table')
    expect(requests).toContain('fields')
  })

  it('leaves the fields in the store, which is what the pages render from', async () => {
    await load()

    expect(useFieldsStore().fields.map((field) => field.key)).toEqual(['company'])
  })

  /**
   * It never turns a failure into a page error itself — `toPageError` decides whether a cause may
   * be asserted, and that judgement belongs to the page throwing the 404 (`docs/decisions.md`).
   */
  it('rejects rather than swallowing a failed table fetch', async () => {
    tableFails = true

    await expect(load()).rejects.toThrow()
  })
})
