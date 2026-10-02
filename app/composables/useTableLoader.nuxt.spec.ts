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
  number: 4,
  name: 'Deals',
  createdAt: '2026-01-05T09:14:00.000Z',
  updatedAt: '2026-01-05T09:14:00.000Z',
}

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

  it('rejects rather than swallowing a failed table fetch', async () => {
    tableFails = true

    await expect(load()).rejects.toThrow()
  })
})
