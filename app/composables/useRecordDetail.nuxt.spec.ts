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

/**
 * A reactive route stub, so the `computed` chain inside the composable re-evaluates when the
 * query moves — the pattern `useDetailLink.nuxt.spec.ts` established, made reactive because
 * this one watches its own derived key.
 */
const route = vi.hoisted(() => ({ current: { query: {} as TUrlQuery } }))
mockNuxtImport('useRoute', () => () => route.current)

function detail(recordId: string, refs: IRecordDetail['relationRefs'] = {}): IRecordDetail {
  return {
    table: { id: 'tbl_deals', name: 'Deals' },
    fields: [textField('company'), relationField()],
    record: record({ id: recordId, number: 1, data: { company: 'Acme' } }),
    relationRefs: refs,
  }
}

/** Which record each stubbed route answers with, and which of them are set to fail. */
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

/**
 * `useAsyncData`'s watch refresh is asynchronous and not a microtask, so every case here has
 * to wait for one. It waits on the **outcome** rather than on a clock: a fixed sleep is the one
 * thing in a suite that turns a slow machine into a red build, and it also lies in the other
 * direction — a sleep that is long enough today passes a race that is already broken.
 */
const awaitRequests = (expected: string[]) => vi.waitFor(() => expect(requests).toEqual(expected))

/**
 * Opened inside a mounted component, which is the shape the composable actually has: its
 * `useAsyncData` needs a Suspense boundary to await the first fetch, so calling it bare at spec
 * top level would leave the request unmade. The return is captured out of `setup` rather than
 * read off `wrapper.vm`, which unwraps refs.
 */
let host: { unmount: () => void } | undefined

async function open(query: TUrlQuery = {}) {
  // The `useAsyncData` key is the literal `'record-detail'`, so one case's entry is the next
  // case's cache and the fetch would be skipped. Tearing the previous owner down and clearing
  // the key together is what actually resets it — clearing alone leaves the instance resolved.
  host?.unmount()
  clearNuxtData('record-detail')

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

  // A sync `setup` does not await its own async data, so Suspense resolves before the first
  // request settles — the dialog renders `pending` and fills in afterwards, same as in the app
  await vi.waitFor(() => expect(dialog.pending.value).toBe(false))

  return { wrapper, dialog }
}

describe('useRecordDetail', () => {
  afterEach(unmountAll)

  beforeEach(() => {
    setActivePinia(useNuxtApp().$pinia as Pinia)
    useRelationsStore().refsByField = {}

    responses = {}
    failures = {}
    requests.length = 0
  })

  describe('the chain', () => {
    it('is empty with no detail param, and fetches nothing', async () => {
      const { dialog } = await open()

      expect(dialog.chain.value).toEqual([])
      // "No record open" is a state the dialog renders, not the absence of an answer
      expect(dialog.detail.value).toBeNull()
      expect(requests).toEqual([])
    })

    it('reads one open record', async () => {
      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.chain.value).toEqual([{ tableId: 'tbl_deals', recordId: 'rec_1' }])
      expect(dialog.detail.value?.record.id).toBe('rec_1')
    })

    /** Only the last entry is shown; the ones before it are what Back walks up. */
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

  /**
   * The same merge-only cache the list feeds, so a relation *inside* the dialog resolves to a
   * ref and can link on again without a second round trip.
   */
  it('caches the relation refs the record came with', async () => {
    responses.rec_1 = detail('rec_1', {
      fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } },
    })

    await open({ detail: 'tbl_deals.rec_1' })

    expect(useRelationsStore().refFor('fld_owner', 'rec_ada')).toEqual({
      number: 1,
      label: 'Ada Lovelace',
    })
  })

  /**
   * The watched source is a **string**, not the ref object: `parseDetailChain` returns fresh
   * objects on every query change, so watching the object would refetch whenever an unrelated
   * param moved. Both directions are counted, because that is the only way the difference shows.
   */
  describe('when it refetches', () => {
    /**
     * A negative is not something to wait for, so this drives a change that *must* refetch
     * straight after the one that must not. If the unrelated param had queued a fetch, it
     * would appear between the two — and the watcher is proved alive rather than merely slow,
     * which a sleep-and-assert-nothing could never distinguish.
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
    /** The one status that names its own cause: deleted after the link was drawn. */
    it('names a 404 for what it is, and offers no retry', async () => {
      failures.rec_1 = 404

      const { dialog } = await open({ detail: 'tbl_deals.rec_1' })

      expect(dialog.errorMessage.value).toBe('This record no longer exists.')
      // Retrying a 404 cannot help
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

  /** Every control is a route target, which is what makes Back reverse exactly one step. */
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

      // An empty chain yields `undefined`, which the router drops — no empty param left behind
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

    // Suspense awaits the first fetch, which is what lets a shared link render server-side
    expect(dialog.pending.value).toBe(false)
    expect(dialog.detail.value?.record.id).toBe('rec_1')
  })
})
