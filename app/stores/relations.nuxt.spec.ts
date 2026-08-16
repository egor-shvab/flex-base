import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import type { IRecordOption } from '#shared/types/record'
import { useRelationsStore } from '~/stores/relations'
import { relationField, textField } from '~~/test/fixtures'

const OWNER = relationField({}, { id: 'fld_owner', key: 'owner' })
const REVIEWER = relationField({}, { id: 'fld_reviewer', key: 'reviewer' })

/** What each field's endpoint answers with, and every query it was asked. */
const responses: Record<string, IRecordOption[]> = {}
const requests: { fieldId: string; q: string | undefined }[] = []

for (const fieldId of ['fld_owner', 'fld_reviewer']) {
  registerEndpoint(`/api/tables/tbl_deals/fields/${fieldId}/options`, (event) => {
    const { q } = getQuery(event)
    requests.push({ fieldId, q: typeof q === 'string' ? q : undefined })

    return { options: responses[fieldId] ?? [] }
  })
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

  describe('loadOptions', () => {
    /** A table without relations must make no request at all — not one that returns nothing. */
    it('makes no request for a table with no relation fields', async () => {
      const store = useRelationsStore()

      await store.loadOptions('tbl_deals', [textField('company'), textField('notes')])

      expect(requests).toEqual([])
    })

    it('loads every relation field of a table in one pass', async () => {
      const store = useRelationsStore()

      await store.loadOptions('tbl_deals', [textField('company'), OWNER, REVIEWER])

      expect(requests.map((request) => request.fieldId).sort()).toEqual([
        'fld_owner',
        'fld_reviewer',
      ])
      expect(store.optionsFor('fld_owner')).toEqual(responses.fld_owner)
      expect(store.optionsFor('fld_reviewer')).toEqual(responses.fld_reviewer)
    })

    /** An option already carries a ref; caching it is what lets a cell read without a fetch. */
    it('caches a linked record for every option it loaded', async () => {
      const store = useRelationsStore()

      await store.loadOptions('tbl_deals', [OWNER])

      expect(store.linkedRecordFor('fld_owner', 'rec_ada')).toEqual({
        number: 1,
        label: 'Ada Lovelace',
      })
      expect(store.linkedRecordFor('fld_owner', 'rec_grace')).toEqual({
        number: 2,
        label: 'Grace Hopper',
      })
    })

    /** `optionsFor` is read by pickers on every render; an unloaded field must not be a crash. */
    it('answers with an empty list for a field it has never loaded', () => {
      const store = useRelationsStore()

      expect(store.optionsFor('fld_unknown')).toEqual([])
      expect(store.linkedRecordFor('fld_unknown', 'rec_1')).toBeUndefined()
    })

    it('remembers which table answers for each field', async () => {
      const store = useRelationsStore()

      await store.loadOptions('tbl_deals', [OWNER])

      expect(store.tableIdByField.fld_owner).toBe('tbl_deals')
    })
  })

  describe('cacheLinkedRecords', () => {
    /**
     * Merged per field rather than replaced: refs arrive from two places — the candidates a
     * picker offers, and the refs a page of records came with — and neither is the whole set.
     */
    it('merges into a field’s existing linked records instead of replacing them', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({ fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } } })
      store.cacheLinkedRecords({ fld_owner: { rec_grace: { number: 2, label: 'Grace Hopper' } } })

      expect(store.linkedRecordFor('fld_owner', 'rec_ada')?.label).toBe('Ada Lovelace')
      expect(store.linkedRecordFor('fld_owner', 'rec_grace')?.label).toBe('Grace Hopper')
    })

    it('overwrites the linked record for the same id', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({ fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } } })
      store.cacheLinkedRecords({ fld_owner: { rec_ada: { number: 1, label: 'Ada L.' } } })

      expect(store.linkedRecordFor('fld_owner', 'rec_ada')).toEqual({ number: 1, label: 'Ada L.' })
    })

    /** Two fields may point at one table through different label fields. */
    it('keeps each field’s linked records separate', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({
        fld_owner: { rec_ada: { number: 1, label: 'Ada Lovelace' } },
        fld_reviewer: { rec_ada: { number: 1, label: 'A. Lovelace' } },
      })

      expect(store.linkedRecordFor('fld_owner', 'rec_ada')?.label).toBe('Ada Lovelace')
      expect(store.linkedRecordFor('fld_reviewer', 'rec_ada')?.label).toBe('A. Lovelace')
    })

    /** A record with nothing to name it by still has a number, which is the whole reference. */
    it('keeps a null label rather than treating it as unresolved', () => {
      const store = useRelationsStore()

      store.cacheLinkedRecords({ fld_owner: { rec_blank: { number: 8, label: null } } })

      expect(store.linkedRecordFor('fld_owner', 'rec_blank')).toEqual({ number: 8, label: null })
    })
  })

  describe('searchOptions', () => {
    it('returns nothing without asking when the field was never seeded', async () => {
      const store = useRelationsStore()

      const results = await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(results).toEqual([])
      expect(requests).toEqual([])
    })

    it('passes the term through to the server', async () => {
      const store = useRelationsStore()
      await store.loadOptions('tbl_deals', [OWNER])
      requests.length = 0

      responses.fld_owner = [{ id: 'rec_ada', number: 1, label: 'Ada Lovelace' }]
      const results = await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(requests).toEqual([{ fieldId: 'fld_owner', q: 'ada' }])
      expect(results).toEqual([{ id: 'rec_ada', number: 1, label: 'Ada Lovelace' }])
    })

    /**
     * `optionsFor()` is the seed every other consumer reads. A search result is a narrower
     * answer to a different question and would clobber it.
     */
    it('does not overwrite the seed list', async () => {
      const store = useRelationsStore()
      await store.loadOptions('tbl_deals', [OWNER])
      const seed = store.optionsFor('fld_owner')

      responses.fld_owner = [{ id: 'rec_ada', number: 1, label: 'Ada Lovelace' }]
      await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(store.optionsFor('fld_owner')).toEqual(seed)
      expect(store.optionsFor('fld_owner')).toHaveLength(2)
    })

    /** So a record found only through a search still reads as itself, with no second trip. */
    it('caches the linked records it found', async () => {
      const store = useRelationsStore()
      await store.loadOptions('tbl_deals', [OWNER])

      responses.fld_owner = [{ id: 'rec_late', number: 9, label: 'Found by searching' }]
      await store.searchOptions('fld_owner', 'found', new AbortController().signal)

      expect(store.linkedRecordFor('fld_owner', 'rec_late')).toEqual({
        number: 9,
        label: 'Found by searching',
      })
      // …without losing what the seed already taught it
      expect(store.linkedRecordFor('fld_owner', 'rec_ada')?.label).toBe('Ada Lovelace')
    })
  })
})
