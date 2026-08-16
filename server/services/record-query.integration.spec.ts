import { beforeEach, describe, expect, it } from 'vitest'
import { listRecords } from '#server/services/records'
import {
  CREATED_AT_KEY,
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  RECORD_NUMBER_KEY,
} from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues } from '#shared/types/filter'
import type { IRecordQuery } from '#shared/types/record'
import {
  createField,
  createFields,
  createRecord,
  createRecords,
  createTable,
  createUser,
} from '~~/test/integration/seed'

/**
 * The half `record-query.spec.ts` cannot reach. That spec asserts on `.text` and `.values` and
 * never executes, so a fragment PostgreSQL rejects — a bad cast, a mis-typed `jsonb_exists_any`
 * argument, an operator that binds differently than it reads — passes every test in the unit
 * suite. Everything here runs the SQL for real and looks at which rows come back.
 */

let tableId: string
let fields: IField[]

const query = (overrides: Partial<IRecordQuery> = {}): IRecordQuery => ({
  page: 1,
  pageSize: 50,
  sort: { key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION },
  filters: {},
  search: '',
  ...overrides,
})

/** The company names matching a filter, which is what makes a failure readable. */
async function matching(filters: TRecordFilterValues, overrides: Partial<IRecordQuery> = {}) {
  const page = await listRecords(tableId, fields, query({ filters, ...overrides }))
  return page.records.map((record) => record.data.company)
}

beforeEach(async () => {
  const user = await createUser()
  const table = await createTable(user.id)
  tableId = table.id

  fields = await createFields(tableId, [
    { key: 'company', type: 'TEXT' },
    { key: 'contract_value', type: 'NUMBER' },
    { key: 'active', type: 'BOOLEAN' },
    { key: 'signed_on', type: 'DATE' },
    {
      key: 'stage',
      type: 'SELECT',
      options: {
        choices: [
          { value: 'Won', color: 'green' },
          { value: 'Lost', color: 'red' },
        ],
      },
    },
    {
      key: 'tags',
      type: 'SELECT',
      options: {
        choices: [
          { value: 'urgent', color: 'red' },
          { value: 'renewal', color: 'blue' },
        ],
        multiple: true,
      },
    },
  ])

  await createRecords(tableId, [
    {
      company: 'Acme',
      contract_value: 100,
      active: true,
      signed_on: '2026-01-15',
      stage: 'Won',
      tags: ['urgent'],
    },
    {
      company: 'Beta',
      contract_value: 9,
      active: false,
      signed_on: '2026-03-02',
      stage: 'Lost',
      tags: ['renewal', 'urgent'],
    },
    {
      company: 'Gamma',
      contract_value: 1000,
      active: true,
      signed_on: '2025-12-31',
      stage: 'Won',
      tags: [],
    },
  ])
})

describe('the WHERE clause selects the rows it claims to', () => {
  it('matches TEXT on a substring, case-insensitively', async () => {
    expect(await matching({ company: 'cm' })).toEqual(['Acme'])
  })

  it('finds nothing rather than erroring for a term nothing matches', async () => {
    expect(await matching({ company: 'nobody' })).toEqual([])
  })

  /** The cast is the point: as text, '9' sorts and compares above '1000'. */
  it('compares NUMBER numerically, not as text', async () => {
    expect(await matching({ contract_value: { from: 10, to: null } })).toEqual(['Gamma', 'Acme'])
  })

  it('applies both bounds of a range inclusively', async () => {
    expect(await matching({ contract_value: { from: 100, to: 1000 } })).toEqual(['Gamma', 'Acme'])
  })

  it('compares BOOLEAN as a boolean', async () => {
    expect(await matching({ active: true })).toEqual(['Gamma', 'Acme'])
    expect(await matching({ active: false })).toEqual(['Beta'])
  })

  it('orders DATE chronologically through its stored text', async () => {
    expect(await matching({ signed_on: { from: '2026-01-01', to: null } })).toEqual([
      'Beta',
      'Acme',
    ])
  })

  it('matches a SELECT on any of the chosen values', async () => {
    expect(await matching({ stage: ['Won'] })).toEqual(['Gamma', 'Acme'])
    expect(await matching({ stage: ['Won', 'Lost'] })).toEqual(['Gamma', 'Beta', 'Acme'])
  })

  /** `jsonb_exists_any` over the stored array — the one comparison here that is indexable. */
  it('matches a multi-value SELECT where the lists overlap', async () => {
    expect(await matching({ tags: ['urgent'] })).toEqual(['Beta', 'Acme'])
    expect(await matching({ tags: ['renewal'] })).toEqual(['Beta'])
  })

  it('leaves out a row whose list is empty', async () => {
    expect(await matching({ tags: ['urgent', 'renewal'] })).not.toContain('Gamma')
  })

  it('ANDs several filters rather than widening', async () => {
    expect(await matching({ stage: ['Won'], active: true, company: 'a' })).toEqual([
      'Gamma',
      'Acme',
    ])
    expect(await matching({ stage: ['Won'], active: false })).toEqual([])
  })

  it('filters the record number as text, so 1 finds #1 but not #2', async () => {
    const page = await listRecords(
      tableId,
      fields,
      query({ filters: { [RECORD_NUMBER_KEY]: '1' } }),
    )

    expect(page.records.map((record) => record.number)).toEqual([1])
  })

  /**
   * The `::date` cast on the timestamp columns, which is the whole reason they project to
   * something other than themselves. A range's bounds are dates, so an uncast `createdAt <=
   * '2026-01-05'` means *midnight* — and every record made during the day the user asked for
   * drops out of its own filter. Only the database can answer this: `record-query.spec.ts`
   * asserts the cast is in the string, not what PostgreSQL does with it.
   *
   * Its own table, because the shared fixture's rows are all created "now", and timestamps at
   * **midday** so `::date` reads as the same calendar day whatever offset the driver applies.
   */
  it('matches a same-day Created at range, including records made later that day', async () => {
    const table = await createTable((await createUser()).id)
    const textOnly = await createFields(table.id, [{ key: 'company', type: 'TEXT' }])

    await createRecord(
      table.id,
      { company: 'Before' },
      { createdAt: new Date('2026-01-04T12:00:00Z') },
    )
    await createRecord(
      table.id,
      { company: 'Sameday' },
      { createdAt: new Date('2026-01-05T12:00:00Z') },
    )
    await createRecord(
      table.id,
      { company: 'After' },
      { createdAt: new Date('2026-01-06T12:00:00Z') },
    )

    const page = await listRecords(
      table.id,
      textOnly,
      query({ filters: { [CREATED_AT_KEY]: { from: '2026-01-05', to: '2026-01-05' } } }),
    )

    expect(page.records.map((record) => record.data.company)).toEqual(['Sameday'])
  })
})

describe('free-text search', () => {
  const searching = (term: string) => matching({}, { search: term })

  it('matches a TEXT field', async () => {
    expect(await searching('acm')).toEqual(['Acme'])
  })

  it('matches a SELECT value', async () => {
    expect(await searching('Lost')).toEqual(['Beta'])
  })

  it('matches an element of a multi-value SELECT', async () => {
    expect(await searching('renew')).toEqual(['Beta'])
  })

  /**
   * The bare number, not the `#` form: the projection is `"number"::text`, so typing `4` finds
   * `#4`, `#14` and `#42` alike. (`#` belongs to the relation picker's own predicate, which
   * falls back to a `#number` label.) Its own table, because every date in the shared fixture
   * contains a digit and DATE is searched too.
   */
  it('matches the record number, which nothing else here carries', async () => {
    const table = await createTable((await createUser()).id)
    const textOnly = await createFields(table.id, [{ key: 'company', type: 'TEXT' }])
    await createRecords(table.id, [{ company: 'Alpha' }, { company: 'Beta' }, { company: 'Gamma' }])

    const page = await listRecords(table.id, textOnly, query({ search: '2' }))

    expect(page.records.map((record) => record.number)).toEqual([2])
  })

  /**
   * The storage format must not leak into results. A multi-value SELECT stores a JSONB array,
   * and `matchesAnyElement` unnests it through `jsonb_array_elements_text` precisely so the
   * brackets, quotes and commas holding it together are not searchable text. Projecting with
   * `->>` instead would still "work" — every term below would simply start matching rows,
   * which is a lie rather than a near miss.
   *
   * The separator is `", "`, not `","`: **jsonb normalises its text output**, so Beta's tags
   * render as `["renewal", "urgent"]` with a space after the comma. A `","` probe passes even
   * against the broken projection, which makes it no test at all — found by breaking the
   * projection and watching which of these three stayed green.
   *
   * Two characters and up, so each is a term the app could really submit: `SEARCH_MIN_LENGTH`
   * drops anything shorter before it reaches the endpoint.
   */
  it.each(['["', '", "', '"]'])(
    'does not match a multi SELECT on its JSON punctuation: %s',
    async (term) => {
      expect(await searching(term)).toEqual([])
    },
  )

  /**
   * RELATION opts out of search entirely — the stored value is a cuid, and matching the label
   * instead would run `targetLabel`'s correlated subquery per row against a count query that
   * has no `LIMIT`. The positive half is what keeps this honest: without it the case would
   * pass just as well against a table nothing could ever find.
   */
  it('does not search a RELATION column, by its label or by its stored id', async () => {
    const user = await createUser()
    const people = await createTable(user.id, 'People')
    const nameField = await createFields(people.id, [{ key: 'full_name', type: 'TEXT' }])
    const [ada] = await createRecords(people.id, [{ full_name: 'Ada Lovelace' }])

    const deals = await createTable(user.id, 'Deals')
    const company = await createField(deals.id, { key: 'company', type: 'TEXT' })
    const owner = await createField(deals.id, {
      key: 'owner',
      type: 'RELATION',
      order: 1,
      options: { targetTableId: people.id, labelFieldKey: 'full_name' },
    })
    await createRecords(deals.id, [{ company: 'Acme', owner: ada?.id ?? '' }])

    const dealFields = [company, owner]
    const found = async (term: string) => {
      const page = await listRecords(deals.id, dealFields, query({ search: term }))
      return page.records.map((record) => record.data.company)
    }

    expect(nameField).toHaveLength(1)
    // The label is on the linked record, and this table's search never reaches it
    expect(await found('lovelace')).toEqual([])
    expect(await found(ada?.id.slice(0, 8) ?? '')).toEqual([])
    // …while the row is perfectly findable by its own text
    expect(await found('acme')).toEqual(['Acme'])
  })

  it('treats a wildcard the user typed as a literal', async () => {
    // `%` unescaped would match every row rather than none
    expect(await searching('%')).toEqual([])
  })

  it('treats a backslash as a literal too, so the escape cannot be smuggled in', async () => {
    expect(await searching('\\')).toEqual([])
  })

  it('narrows alongside a filter rather than replacing it', async () => {
    expect(await matching({ stage: ['Won'] }, { search: 'gam' })).toEqual(['Gamma'])
  })
})

describe('ORDER BY', () => {
  const ordered = async (key: string, direction: 'asc' | 'desc') => {
    const page = await listRecords(tableId, fields, query({ sort: { key, direction } }))
    return page.records.map((record) => record.data.company)
  }

  it('sorts NUMBER numerically, so 9 comes before 100', async () => {
    expect(await ordered('contract_value', 'asc')).toEqual(['Beta', 'Acme', 'Gamma'])
  })

  it('sorts the record number as an integer', async () => {
    const page = await listRecords(
      tableId,
      fields,
      query({ sort: { key: RECORD_NUMBER_KEY, direction: 'asc' } }),
    )

    expect(page.records.map((record) => record.number)).toEqual([1, 2, 3])
  })

  it('sorts TEXT alphabetically in both directions', async () => {
    expect(await ordered('company', 'asc')).toEqual(['Acme', 'Beta', 'Gamma'])
    expect(await ordered('company', 'desc')).toEqual(['Gamma', 'Beta', 'Acme'])
  })

  it('sorts DATE chronologically', async () => {
    expect(await ordered('signed_on', 'asc')).toEqual(['Gamma', 'Acme', 'Beta'])
  })

  it('sorts a multi-value SELECT by its first value', async () => {
    // Gamma's list is empty, so it sorts last whichever direction the others take
    expect((await ordered('tags', 'asc')).at(-1)).toBe('Gamma')
  })

  it('falls back to creation order for a key the table does not own, keeping the direction', async () => {
    expect(await ordered('ghost', 'asc')).toEqual(['Acme', 'Beta', 'Gamma'])
    expect(await ordered('ghost', 'desc')).toEqual(['Gamma', 'Beta', 'Acme'])
  })
})

describe('paging and counting', () => {
  it('counts every matching row, not just the page', async () => {
    const page = await listRecords(tableId, fields, query({ pageSize: 2 }))

    expect(page.records).toHaveLength(2)
    expect(page.total).toBe(3)
  })

  it('offsets to the next page', async () => {
    const page = await listRecords(tableId, fields, query({ page: 2, pageSize: 2 }))

    expect(page.records).toHaveLength(1)
    expect(page.total).toBe(3)
  })

  it('counts what the filter matched, so the pager does not promise pages that are not there', async () => {
    const page = await listRecords(tableId, fields, query({ filters: { stage: ['Won'] } }))

    expect(page.total).toBe(2)
  })

  it('comes back empty past the end rather than erroring', async () => {
    const page = await listRecords(tableId, fields, query({ page: 9 }))

    expect(page.records).toEqual([])
    expect(page.total).toBe(3)
  })
})

describe('table scoping', () => {
  it('never returns another table’s rows, even one owned by the same user', async () => {
    const page = await listRecords(tableId, fields, query())
    expect(page.total).toBe(3)

    const other = await createTable((await createUser()).id)
    await createRecords(other.id, [{ company: 'Elsewhere' }])

    const again = await listRecords(tableId, fields, query())
    expect(again.total).toBe(3)
    expect(again.records.map((record) => record.data.company)).not.toContain('Elsewhere')
  })
})
