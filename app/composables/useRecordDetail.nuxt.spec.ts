import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, useNuxtApp } from '#imports'
import { createError } from 'h3'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import type { TUrlQuery } from '#shared/types/query'
import type { IRecordDetail } from '#shared/types/record'
import { useRecordDetail } from '~/composables/useRecordDetail'
import { useRelationsStore } from '~/stores/relations'
import { record, relationField, textField } from '~~/test/fixtures'
import { mountTracked, unmountAll } from '~~/test/mount'

const route = vi.hoisted(() => ({ current: { query: {} as TUrlQuery } }))
mockNuxtImport('useRoute', () => () => route.current)

function detail(recordId: string, linked: IRecordDetail['linkedRecords'] = {}): IRecordDetail {
  return {
    table: { id: 'tbl_deals', number: 1, name: 'Deals' },
    fields: [textField('company'), relationField()],
    record: record({ id: recordId, number: 1, data: { company: 'Acme' } }),
    linkedRecords: linked,
  }
}

let responses: Record<string, IRecordDetail> = {}
let failures: Record<string, number> = {}
const requests: string[] = []

for (const [tableId, recordId] of [
  ['tbl_deals', 'rec_1'],
  ['tbl_deals', 'rec_2'],
  ['tbl_people', 'rec_ada'],
] as const) {
  registerEndpoint(`/api/tables/${tableId}/records/${recordId}`, () => {
    requests.push(recordId)

    const status = failures[recordId]
    if (status !== undefined) throw createError({ statusCode: status, statusMessage: 'Nope' })

    return responses[recordId] ?? detail(recordId)
  })
}

const awaitRequests = (expected: string[]) => vi.waitFor(() => expect(requests).toEqual(expected))

let host: { unmount: () => void } | undefined

async function open(query: TUrlQuery = {}) {
  // Keys are per record, so tearing the owner down and clearing the keys are both needed to
  // reset a cache another case shares
  host?.unmount()
  clearNuxtData((key) => key.startsWith('record-detail'))

  route.current = reactive({ query })

  let dialog!: ReturnType<typeof useRecordDetail>

  const Host = defineComponent({
    setup() {
      dialog = useRecordDetail()
      return () => h('div')
    },
  })

  const wrapper = await mountTracked(Host)
  host = wrapper

  await vi.waitFor(() => expect(dialog.pending.value).toBe(false))

  return { wrapper, dialog }
}

describe('useRecordDetail', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    useRelationsStore().linkedByField = {}

    responses = {}
    failures = {}
    requests.length = 0
  })

  describe('the chain', () => {
    it('is empty with no detail param, and fetches nothing', async () => {
      const { dialog } = await open()

      expect(dialog.chain.value).toEqual([])
      expect(dialog.detail.value).toBeNull()
      expect(requests).toEqual([])
    })

    it('reads one open record', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.chain.value).toEqual([{ tableAddress: 'tbl_deals', recordAddress: 'rec_1' }])
      expect(dialog.detail.value?.record.id).toBe('rec_1')
    })

    it('shows the last of a chain and keeps the trail', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1,tbl_people.rec_ada' })

      expect(dialog.chain.value).toHaveLength(2)
      expect(dialog.detail.value?.record.id).toBe('rec_ada')
      expect(requests).toEqual(['rec_ada'])
    })

    it('degrades a malformed chain rather than throwing', async () => {
      const { dialog } = await open({ detail: 'not-a-ref' })

      expect(dialog.chain.value).toEqual([])
      expect(dialog.detail.value).toBeNull()
    })
  })

  it('caches the linked records the record came with', async () => {
    responses.rec_1 = detail('rec_1', {
      fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } },
    })

    await open({ detail: 'tbl_deals.rec_1' })

    expect(useRelationsStore().linkedRecordFor('fld_owner', 'rec_ada')).toEqual({
      number: 1,
      label: 'Ada Lovelace',
    })
  })

  describe('when it refetches', () => {
    /**
     * A negative cannot be waited for, so a change that must refetch follows straight after: a
     * queued fetch would appear between the two.
     */
    it('does not refetch when an unrelated param moves', async () => {
      await open({ detail: 'tbl_deals.rec_1', page: '1' })
      expect(requests).toEqual(['rec_1'])

      route.current.query = { detail: 'tbl_deals.rec_1', page: '2', sort: 'company' }
      route.current.query = { detail: 'tbl_deals.rec_2', page: '2', sort: 'company' }

      await awaitRequests(['rec_1', 'rec_2'])
    })

    it('refetches when the open record changes', async () => {
      await open({ detail: 'tbl_deals.rec_1' })

      route.current.query = { detail: 'tbl_deals.rec_2' }

      await awaitRequests(['rec_1', 'rec_2'])
    })

    it('refetches when a relation is drilled into', async () => {
      await open({ detail: 'tbl_deals.rec_1' })

      route.current.query = { detail: 'tbl_deals.rec_1,tbl_people.rec_ada' }

      await awaitRequests(['rec_1', 'rec_ada'])
    })

    it('re-runs the request on refresh', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      await dialog.refresh()

      expect(requests).toEqual(['rec_1', 'rec_1'])
    })
  })

  describe('failure', () => {
    it('names a 404 for what it is, and offers no retry', async () => {
      failures.rec_1 = 404

      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.errorMessage.value).toBe('This record no longer exists.')
      expect(dialog.canRetry.value).toBe(false)
    })

    it('offers a retry for anything else', async () => {
      failures.rec_1 = 500

      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.errorMessage.value).toBe('Nope')
      expect(dialog.canRetry.value).toBe(true)
    })

    it('reports no error at all when nothing went wrong', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.errorMessage.value).toBeNull()
      expect(dialog.canRetry.value).toBe(false)
    })
  })

  describe('where its controls point', () => {
    it('offers no way back from the outermost record', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.backTo.value).toBeUndefined()
    })

    it('goes back exactly one level', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1,tbl_people.rec_ada' })

      expect(dialog.backTo.value?.query.detail).toBe('tbl_deals.rec_1')
    })

    it('drops the param entirely on close', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.closeTo.value.query.detail).toBeUndefined()
    })

    it('keeps the list query it was opened over', async () => {
      const { dialog } = await open({
        detail: 'tbl_deals.rec_1,tbl_people.rec_ada',
        page: '3',
        'f.stage': 'Won',
      })

      expect(dialog.backTo.value?.query).toMatchObject({ page: '3', 'f.stage': 'Won' })
      expect(dialog.closeTo.value.query).toMatchObject({ page: '3', 'f.stage': 'Won' })
    })
  })

  it('has settled by the time the dialog renders', async () => {
    const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

    expect(dialog.pending.value).toBe(false)
    expect(dialog.detail.value?.record.id).toBe('rec_1')
  })
})
