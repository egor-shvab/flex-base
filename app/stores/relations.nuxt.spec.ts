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
      { id: 'rec_ada', label: 'Ada Lovelace' },
      { id: 'rec_grace', label: 'Grace Hopper' },
    ]
    responses.fld_reviewer = [{ id: 'rec_alan', label: 'Alan Turing' }]
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

    it('caches a label for every option it loaded', async () => {
      const store = useRelationsStore()

      await store.loadOptions('tbl_deals', [OWNER])

      expect(store.labelFor('fld_owner', 'rec_ada')).toBe('Ada Lovelace')
      expect(store.labelFor('fld_owner', 'rec_grace')).toBe('Grace Hopper')
    })

    /** `optionsFor` is read by pickers on every render; an unloaded field must not be a crash. */
    it('answers with an empty list for a field it has never loaded', () => {
      const store = useRelationsStore()

      expect(store.optionsFor('fld_unknown')).toEqual([])
      expect(store.labelFor('fld_unknown', 'rec_1')).toBeUndefined()
    })

    it('remembers which table answers for each field', async () => {
      const store = useRelationsStore()

      await store.loadOptions('tbl_deals', [OWNER])

      expect(store.tableIdByField.fld_owner).toBe('tbl_deals')
    })
  })

  describe('cacheLabels', () => {
    /**
     * Merged per field rather than replaced: labels arrive from two places — the candidates a
     * picker offers, and the labels a page of records came with — and neither is the whole set.
     */
    it('merges into a field’s existing labels instead of replacing them', () => {
      const store = useRelationsStore()

      store.cacheLabels({ fld_owner: { rec_ada: 'Ada Lovelace' } })
      store.cacheLabels({ fld_owner: { rec_grace: 'Grace Hopper' } })

      expect(store.labelFor('fld_owner', 'rec_ada')).toBe('Ada Lovelace')
      expect(store.labelFor('fld_owner', 'rec_grace')).toBe('Grace Hopper')
    })

    it('overwrites a label for the same record', () => {
      const store = useRelationsStore()

      store.cacheLabels({ fld_owner: { rec_ada: 'Ada Lovelace' } })
      store.cacheLabels({ fld_owner: { rec_ada: 'Ada L.' } })

      expect(store.labelFor('fld_owner', 'rec_ada')).toBe('Ada L.')
    })

    /** Two fields may point at one table through different label fields. */
    it('keeps each field’s labels separate', () => {
      const store = useRelationsStore()

      store.cacheLabels({
        fld_owner: { rec_ada: 'Ada Lovelace' },
        fld_reviewer: { rec_ada: 'A. Lovelace' },
      })

      expect(store.labelFor('fld_owner', 'rec_ada')).toBe('Ada Lovelace')
      expect(store.labelFor('fld_reviewer', 'rec_ada')).toBe('A. Lovelace')
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

      responses.fld_owner = [{ id: 'rec_ada', label: 'Ada Lovelace' }]
      const results = await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(requests).toEqual([{ fieldId: 'fld_owner', q: 'ada' }])
      expect(results).toEqual([{ id: 'rec_ada', label: 'Ada Lovelace' }])
    })

    /**
     * `optionsFor()` is the seed every other consumer reads. A search result is a narrower
     * answer to a different question and would clobber it.
     */
    it('does not overwrite the seed list', async () => {
      const store = useRelationsStore()
      await store.loadOptions('tbl_deals', [OWNER])
      const seed = store.optionsFor('fld_owner')

      responses.fld_owner = [{ id: 'rec_ada', label: 'Ada Lovelace' }]
      await store.searchOptions('fld_owner', 'ada', new AbortController().signal)

      expect(store.optionsFor('fld_owner')).toEqual(seed)
      expect(store.optionsFor('fld_owner')).toHaveLength(2)
    })

    /** So a record found only through a search still renders as its label, with no second trip. */
    it('caches the labels it found', async () => {
      const store = useRelationsStore()
      await store.loadOptions('tbl_deals', [OWNER])

      responses.fld_owner = [{ id: 'rec_late', label: 'Found by searching' }]
      await store.searchOptions('fld_owner', 'found', new AbortController().signal)

      expect(store.labelFor('fld_owner', 'rec_late')).toBe('Found by searching')
      // …without losing what the seed already taught it
      expect(store.labelFor('fld_owner', 'rec_ada')).toBe('Ada Lovelace')
    })
  })
})
