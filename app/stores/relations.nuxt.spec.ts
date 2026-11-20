import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IRecordOption } from '#shared/types/record'
import { useRelationsStore } from '~/stores/relations'

const WS = 'k3f9x2m8qa'

const responses: Record<string, IRecordOption[]> = {}
const requests: { fieldId: string; q: string | undefined }[] = []

for (const fieldId of ['fld_owner', 'fld_reviewer']) {
  registerEndpoint(
    `/api/workspaces/k3f9x2m8qa/tables/tbl_deals/fields/${fieldId}/options`,
    (event) => {
      const { q } = getQuery(event)
      requests.push({ fieldId, q: typeof q === 'string' ? q : undefined })

      return { options: responses[fieldId] ?? [] }
    },
  )
}

describe('useRelationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    requests.length = 0
    responses.fld_owner = [
      { id: 'rec_ada', number: 1, label: 'Ada Lovelace' },
      { id: 'rec_grace', number: 2, label: 'Grace Hopper' },
    ]
    responses.fld_reviewer = [{ id: 'rec_alan', number: 3, label: 'Alan Turing' }]
  })

  describe('ensureOptions', () => {
    it('asks nothing until a source is set', async () => {
      const store = useRelationsStore()

      await store.ensureOptions('fld_owner')

      expect(requests).toEqual([])
      expect(store.findOptionStatus('fld_owner')).toBe('idle')
    })

    it('loads one field’s options from the table the page set, and only that field', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_deals')

      await store.ensureOptions('fld_owner')

      expect(requests).toEqual([{ fieldId: 'fld_owner', q: undefined }])
      expect(store.optionsFor('fld_owner')).toEqual(responses.fld_owner)
      expect(store.optionsFor('fld_reviewer')).toEqual([])
      expect(store.findOptionStatus('fld_owner')).toBe('ready')
    })

    it('asks once, however many pickers mount', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_deals')

      await Promise.all([store.ensureOptions('fld_owner'), store.ensureOptions('fld_owner')])
      await store.ensureOptions('fld_owner')

      expect(requests).toHaveLength(1)
    })

    it('caches a linked record for every option it loaded', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_deals')

      await store.ensureOptions('fld_owner')

      expect(store.findLinkedRecord('fld_owner', 'rec_ada')).toEqual({
        number: 1,
        label: 'Ada Lovelace',
      })
      expect(store.findLinkedRecordByNumber('fld_owner', 2)?.label).toBe('Grace Hopper')
    })

    it('answers with an empty list for a field it has never loaded', () => {
      const store = useRelationsStore()

      expect(store.optionsFor('fld_unknown')).toEqual([])
      expect(store.findLinkedRecord('fld_unknown', 'rec_1')).toBeUndefined()
    })

    it('marks a failed load, and tries again on the next call', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_missing')

      await store.ensureOptions('fld_owner')
      expect(store.findOptionStatus('fld_owner')).toBe('failed')

      store.setOptionSource(WS, 'tbl_deals')
      await store.ensureOptions('fld_owner')
      expect(store.findOptionStatus('fld_owner')).toBe('ready')
    })
  })

  describe('clearState', () => {
    it('forgets every option and linked record, so the next table starts clean', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_deals')
      await store.ensureOptions('fld_owner')

      store.clearState()

      expect(store.optionsFor('fld_owner')).toEqual([])
      expect(store.findOptionStatus('fld_owner')).toBe('idle')
      expect(store.findLinkedRecord('fld_owner', 'rec_ada')).toBeUndefined()
      expect(store.findLinkedRecordByNumber('fld_owner', 1)).toBeUndefined()
    })
  })

  describe('cacheLinkedRecords', () => {
    it('merges into a field’s existing linked records instead of replacing them', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({ fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } } })
      store.cacheLinkedRecords({ fld_owner: { rec_grace: { number: 2, label: 'Grace Hopper' } } })

      expect(store.findLinkedRecord('fld_owner', 'rec_ada')?.label).toBe('Ada Lovelace')
      expect(store.findLinkedRecord('fld_owner', 'rec_grace')?.label).toBe('Grace Hopper')
    })

    it('overwrites the linked record for the same id', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({ fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } } })
      store.cacheLinkedRecords({ fld_owner: { rec_ada: { number: 1, label: 'Ada L.' } } })

      expect(store.findLinkedRecord('fld_owner', 'rec_ada')).toEqual({ number: 1, label: 'Ada L.' })
    })

    it('keeps each field’s linked records separate', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({
        fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } },
        fld_reviewer: { rec_ada: { number: 1, label: 'A. Lovelace' } },
      })

      expect(store.findLinkedRecord('fld_owner', 'rec_ada')?.label).toBe('Ada Lovelace')
      expect(store.findLinkedRecord('fld_reviewer', 'rec_ada')?.label).toBe('A. Lovelace')
    })

    it('keeps a null label rather than treating it as unresolved', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({ fld_owner: { rec_blank: { number: 8, label: null } } })

      expect(store.findLinkedRecord('fld_owner', 'rec_blank')).toEqual({ number: 8, label: null })
    })
  })

  describe('searchOptions', () => {
    it('returns nothing without asking when no source is set', async () => {
      const store = useRelationsStore()

      const results = await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(results).toEqual([])
      expect(requests).toEqual([])
    })

    it('passes the term through to the server', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_deals')
      await store.ensureOptions('fld_owner')
      requests.length = 0

      responses.fld_owner = [{ id: 'rec_ada', number: 1, label: 'Ada Lovelace' }]
      const results = await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(requests).toEqual([{ fieldId: 'fld_owner', q: 'ada' }])
      expect(results).toEqual([{ id: 'rec_ada', number: 1, label: 'Ada Lovelace' }])
    })

    it('does not overwrite the seed list', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_deals')
      await store.ensureOptions('fld_owner')
      const seed = store.optionsFor('fld_owner')

      responses.fld_owner = [{ id: 'rec_ada', number: 1, label: 'Ada Lovelace' }]
      await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(store.optionsFor('fld_owner')).toEqual(seed)
      expect(store.optionsFor('fld_owner')).toHaveLength(2)
    })

    it('caches the linked records it found', async () => {
      const store = useRelationsStore()
      store.setOptionSource(WS, 'tbl_deals')
      await store.ensureOptions('fld_owner')

      responses.fld_owner = [{ id: 'rec_late', number: 9, label: 'Found by searching' }]
      await store.searchOptions('fld_owner', 'found', new AbortController().signal)

      expect(store.findLinkedRecord('fld_owner', 'rec_late')).toEqual({
        number: 9,
        label: 'Found by searching',
      })
      expect(store.findLinkedRecord('fld_owner', 'rec_ada')?.label).toBe('Ada Lovelace')
    })
  })
})
