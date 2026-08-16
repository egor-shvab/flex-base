import { describe, expect, it } from 'vitest'
import {
  CREATED_AT_KEY,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_KEY,
  FILTER_VALUES_MAX,
  RECORD_NUMBER_KEY,
  RESERVED_QUERY_PARAMS,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import type { IRecordQueryState } from '#shared/types/record'
import {
  parseRecordQueryState,
  recordQueryKey,
  toRecordQueryParams,
} from '#shared/utils/record-query'
import {
  asMultiple,
  booleanField,
  dateField,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

/** One table covering every type and both cardinalities — the matrix the codec must survive. */
const fields = [
  textField('company'),
  numberField('contract_value'),
  booleanField('active'),
  dateField('signed_on'),
  selectField(['Won', 'Lost', 'Open']),
  relationField(),
  asMultiple(relationField({}, { key: 'partners' })),
]

const parse = (query: Record<string, unknown>) => parseRecordQueryState(fields, query)

const state = (overrides: Partial<IRecordQueryState> = {}): IRecordQueryState => ({
  page: 1,
  sort: { key: DEFAULT_SORT_KEY, dir: DEFAULT_SORT_DIR },
  filters: {},
  search: '',
  ...overrides,
})

describe('parseRecordQueryState — pagination, sorting, search', () => {
  it('defaults an empty query', () => {
    expect(parse({})).toEqual(state())
  })

  it('reads a page, a sort key and a direction', () => {
    expect(parse({ page: '3', sort: 'company', dir: 'asc' })).toEqual(
      state({ page: 3, sort: { key: 'company', dir: 'asc' } }),
    )
  })

  it('falls back to page 1 for anything that is not a positive integer', () => {
    // Lenient by design — rejecting a crafted link is the query schema's job, not the codec's
    for (const page of ['0', '-3', '2.5', 'abc', '']) {
      expect(parse({ page }).page).toBe(1)
    }
  })

  it('falls back to the default direction for anything but asc/desc', () => {
    expect(parse({ dir: 'ASC' }).sort.dir).toBe(DEFAULT_SORT_DIR)
    expect(parse({ dir: 'sideways' }).sort.dir).toBe(DEFAULT_SORT_DIR)
    expect(parse({ dir: 'asc' }).sort.dir).toBe('asc')
  })

  it('passes an unknown sort key straight through', () => {
    expect(parse({ sort: 'deleted_field' }).sort.key).toBe('deleted_field')
  })

  it('reads `?search=` as not searching, exactly like an absent param', () => {
    expect(parse({ search: '' }).search).toBe('')
    expect(parse({}).search).toBe('')
    expect(parse({ search: 'acme' }).search).toBe('acme')
  })

  it('reads a blank search as not searching however it is padded, and trims a real term', () => {
    // The term the query schema and the SQL will use is the trimmed one, so the state that
    // draws the summary chip must not claim a search the server is not running
    expect(parse({ search: '   ' }).search).toBe('')
    expect(parse({ search: '  acme  ' }).search).toBe('acme')
  })
})

describe('parseRecordQueryState — the filter wire format', () => {
  it('reads a scalar from the bare field key', () => {
    expect(parse({ company: 'acme' }).filters).toEqual({ company: 'acme' })
  })

  it('reads a range from the _from / _to pair', () => {
    expect(parse({ contract_value_from: '100', contract_value_to: '500' }).filters).toEqual({
      contract_value: { from: 100, to: 500 },
    })
  })

  it('reads a range with only one bound', () => {
    expect(parse({ contract_value_from: '100' }).filters).toEqual({
      contract_value: { from: 100, to: null },
    })
    expect(parse({ contract_value_to: '500' }).filters).toEqual({
      contract_value: { from: null, to: 500 },
    })
    expect(parse({ signed_on_from: '2026-01-01' }).filters).toEqual({
      signed_on: { from: '2026-01-01', to: null },
    })
    expect(parse({ signed_on_to: '2026-01-31' }).filters).toEqual({
      signed_on: { from: null, to: '2026-01-31' },
    })
  })

  it('reads a list from the field key repeated', () => {
    expect(parse({ stage: ['Won', 'Lost'] }).filters).toEqual({ stage: ['Won', 'Lost'] })
  })

  it('reads a single repeat, which a router hands over as a bare string', () => {
    expect(parse({ stage: 'Won' }).filters).toEqual({ stage: ['Won'] })
  })

  it('reads `false` as a real BOOLEAN filter rather than as "not filtered"', () => {
    expect(parse({ active: 'false' }).filters).toEqual({ active: false })
    expect(parse({ active: 'true' }).filters).toEqual({ active: true })
  })

  it('reads an empty param as not filtered, never as match-everything', () => {
    expect(parse({ company: '' }).filters).toEqual({})
    expect(parse({ stage: '' }).filters).toEqual({})
    expect(parse({ contract_value_from: '' }).filters).toEqual({})
  })

  it("filters the record's own columns alongside the table's fields", () => {
    expect(
      parse({
        [RECORD_NUMBER_KEY]: '4',
        createdAt_from: '2026-01-01',
        updatedAt_to: '2026-12-31',
      }).filters,
    ).toEqual({
      [RECORD_NUMBER_KEY]: '4',
      [CREATED_AT_KEY]: { from: '2026-01-01', to: null },
      [UPDATED_AT_KEY]: { from: null, to: '2026-12-31' },
    })
  })

  it('keys the filters in column order, so the URL built back from them is stable', () => {
    const filters = parse({ stage: 'Won', company: 'acme', [RECORD_NUMBER_KEY]: '4' }).filters
    expect(Object.keys(filters)).toEqual([RECORD_NUMBER_KEY, 'company', 'stage'])
  })

  it('ignores params the table does not own', () => {
    expect(parse({ utm_source: 'newsletter', deleted_field: 'x' }).filters).toEqual({})
  })
})

describe('parseRecordQueryState — malformed values degrade rather than throw', () => {
  it('drops a NUMBER bound that is not a number', () => {
    expect(parse({ contract_value_from: 'abc' }).filters).toEqual({})
    expect(parse({ contract_value_from: 'Infinity' }).filters).toEqual({})
  })

  it('keeps the readable bound of a half-malformed range', () => {
    expect(parse({ contract_value_from: '100', contract_value_to: 'abc' }).filters).toEqual({
      contract_value: { from: 100, to: null },
    })
  })

  it('drops a DATE that is not ISO', () => {
    expect(parse({ signed_on_from: '2026-1-1' }).filters).toEqual({})
    expect(parse({ signed_on_from: 'yesterday' }).filters).toEqual({})
  })

  it('drops a SELECT value the field does not offer', () => {
    expect(parse({ stage: 'Nope' }).filters).toEqual({})
    expect(parse({ stage: ['Won', 'Nope'] }).filters).toEqual({ stage: ['Won'] })
  })

  it('drops a non-string param value', () => {
    expect(parse({ company: 42 }).filters).toEqual({})
    expect(parse({ stage: [{ crafted: true }, 'Won'] }).filters).toEqual({ stage: ['Won'] })
  })
})

describe('parseRecordQueryState — list bounds', () => {
  const choices = Array.from({ length: FILTER_VALUES_MAX + 5 }, (_, index) => `choice_${index}`)
  const wide = [selectField(choices)]

  it('deduplicates repeats', () => {
    expect(parse({ stage: ['Won', 'Won', 'Lost'] }).filters).toEqual({ stage: ['Won', 'Lost'] })
  })

  it('caps a crafted link at FILTER_VALUES_MAX values', () => {
    // The codec's own cap, not a restatement of the schema's: this reader also runs on the
    // client over an unvalidated `route.query`, where nothing has rejected the link yet
    const filters = parseRecordQueryState(wide, { stage: choices }).filters
    expect(filters.stage).toHaveLength(FILTER_VALUES_MAX)
  })

  it('drops the empty repeats of a list', () => {
    expect(parse({ stage: ['', 'Won', ''] }).filters).toEqual({ stage: ['Won'] })
  })

  it('reads a multi-value RELATION as a list though its type declares a scalar', () => {
    expect(parse({ partners: ['rec_1', 'rec_2'] }).filters).toEqual({
      partners: ['rec_1', 'rec_2'],
    })
  })

  it('still reads a single-value RELATION as a scalar', () => {
    expect(parse({ owner: 'rec_1' }).filters).toEqual({ owner: 'rec_1' })
  })
})

describe('toRecordQueryParams', () => {
  it('emits nothing for an unfiltered default view', () => {
    expect(toRecordQueryParams(state())).toEqual({})
  })

  it('omits every default and emits only what differs', () => {
    expect(toRecordQueryParams(state({ page: 2 }))).toEqual({ page: '2' })
    expect(toRecordQueryParams(state({ sort: { key: 'company', dir: 'desc' } }))).toEqual({
      sort: 'company',
    })
    expect(toRecordQueryParams(state({ sort: { key: DEFAULT_SORT_KEY, dir: 'asc' } }))).toEqual({
      dir: 'asc',
    })
    expect(toRecordQueryParams(state({ search: 'acme' }))).toEqual({ search: 'acme' })
  })

  it("names each param from the value's shape", () => {
    expect(
      toRecordQueryParams(
        state({
          filters: {
            company: 'acme',
            contract_value: { from: 100, to: 500 },
            stage: ['Won', 'Lost'],
          },
        }),
      ),
    ).toEqual({
      company: 'acme',
      contract_value_from: '100',
      contract_value_to: '500',
      stage: ['Lost', 'Won'],
    })
  })

  it('sorts a list, so click order cannot change the URL', () => {
    expect(
      toRecordQueryParams(state({ filters: { stage: ['Open', 'Lost', 'Won'] } })).stage,
    ).toEqual(['Lost', 'Open', 'Won'])
  })

  it('does not mutate the filter value it sorts', () => {
    const stage = ['Won', 'Lost']
    toRecordQueryParams(state({ filters: { stage } }))
    expect(stage).toEqual(['Won', 'Lost'])
  })

  it('trims a string scalar and stringifies a non-string one', () => {
    expect(toRecordQueryParams(state({ filters: { company: '  acme  ' } })).company).toBe('acme')
    expect(toRecordQueryParams(state({ filters: { active: false } })).active).toBe('false')
  })

  it('omits an empty filter whatever its shape', () => {
    expect(
      toRecordQueryParams(
        state({
          filters: {
            company: '   ',
            stage: [],
            contract_value: { from: null, to: null },
            owner: null,
          },
        }),
      ),
    ).toEqual({})
  })

  it('emits only the bound a range actually has', () => {
    expect(
      toRecordQueryParams(state({ filters: { contract_value: { from: 100, to: null } } })),
    ).toEqual({ contract_value_from: '100' })
  })

  it('never writes a reserved param from a filter, on a state that sets none of them', () => {
    // The regression: the assignments below the filter spread only fire when a value differs
    // from its default, so on the default view there was nothing to overwrite a legacy field
    // keyed `search` with — and the server read its value as a site-wide free-text search
    expect(toRecordQueryParams(state({ filters: { search: 'legacy' } }))).toEqual({})

    for (const name of RESERVED_QUERY_PARAMS) {
      expect(toRecordQueryParams(state({ filters: { [name]: 'legacy' } }))).toEqual({})
    }
  })

  it('lets the reserved param win over a legacy field that shares its name', () => {
    // `claimFilterParams` already stops such a field being read back; this is the other half
    const params = toRecordQueryParams(
      state({
        filters: { search: 'legacy', page: 'legacy', sort: 'legacy', dir: 'legacy' },
        search: 'real',
        page: 2,
        sort: { key: 'company', dir: 'asc' },
      }),
    )
    expect(params).toEqual({ search: 'real', page: '2', sort: 'company', dir: 'asc' })
  })

  it('keeps the bounds of a range field keyed like a reserved param — those names are its own', () => {
    // `page_from` is reserved by nothing, so `claimFilterParams` hands it to the field and the
    // filter really does round-trip. The drop is per param name, exactly as the claim is.
    const legacy = [numberField('page')]
    const params = toRecordQueryParams(state({ filters: { page: { from: 100, to: null } } }))

    expect(params).toEqual({ page_from: '100' })
    expect(parseRecordQueryState(legacy, params).filters).toEqual({ page: { from: 100, to: null } })
  })

  it('leaves a scalar field keyed like a reserved param unreachable in both directions', () => {
    const legacy = [textField('search')]
    const decoded = parseRecordQueryState(legacy, { search: 'acme' })

    // Read as the free-text search it names, never as that field's filter…
    expect(decoded.filters).toEqual({})
    expect(decoded.search).toBe('acme')
    // …and never written back from one, so the value can no longer change meaning in transit
    expect(toRecordQueryParams(state({ filters: { search: 'acme' } }))).toEqual({})
  })
})

describe('round-trip', () => {
  it('survives a query covering every type and both cardinalities', () => {
    const original = state({
      page: 4,
      sort: { key: 'company', dir: 'asc' },
      search: 'acme',
      filters: {
        [RECORD_NUMBER_KEY]: '4',
        company: 'acme',
        contract_value: { from: 100, to: 500 },
        active: false,
        signed_on: { from: '2026-01-01', to: '2026-12-31' },
        stage: ['Lost', 'Won'],
        owner: 'rec_1',
        partners: ['rec_2', 'rec_3'],
        [CREATED_AT_KEY]: { from: '2026-01-01', to: null },
        [UPDATED_AT_KEY]: { from: null, to: '2026-12-31' },
      },
    })

    expect(parse(toRecordQueryParams(original))).toEqual(original)
  })

  it('is idempotent — encoding a decoded query changes nothing', () => {
    const query = { page: '2', sort: 'company', dir: 'asc', stage: ['Won', 'Lost'], search: 'x' }
    const once = toRecordQueryParams(parse(query))

    expect(toRecordQueryParams(parse(once))).toEqual(once)
  })

  it('survives an empty query', () => {
    expect(parse(toRecordQueryParams(state()))).toEqual(state())
  })
})

describe('recordQueryKey', () => {
  it('is empty for the default view', () => {
    expect(recordQueryKey(state())).toBe('')
  })

  it('keys two orderings of one selection identically', () => {
    // A watcher must fire on a *changed* query, not on a re-ordered one
    expect(recordQueryKey(parse({ stage: ['Won', 'Lost'] }))).toBe(
      recordQueryKey(parse({ stage: ['Lost', 'Won'] })),
    )
  })

  it('is unmoved by param order', () => {
    expect(recordQueryKey(parse({ company: 'acme', page: '2' }))).toBe(
      recordQueryKey(parse({ page: '2', company: 'acme' })),
    )
  })

  it('changes when the query really changes', () => {
    const base = recordQueryKey(parse({ company: 'acme' }))
    expect(recordQueryKey(parse({ company: 'other' }))).not.toBe(base)
    expect(recordQueryKey(parse({ company: 'acme', page: '2' }))).not.toBe(base)
    expect(recordQueryKey(parse({ company: 'acme', stage: 'Won' }))).not.toBe(base)
  })

  it('ignores a param the list does not own, such as the open detail dialog', () => {
    expect(recordQueryKey(parse({ company: 'acme', detail: 'tbl1.rec1' }))).toBe(
      recordQueryKey(parse({ company: 'acme' })),
    )
  })

  it('joins a list with commas and sorts its keys', () => {
    expect(recordQueryKey(parse({ stage: ['Won', 'Lost'], company: 'acme' }))).toBe(
      'company=acme&stage=Lost,Won',
    )
  })
})
