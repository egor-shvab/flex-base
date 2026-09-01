import { beforeEach, describe, expect, it } from 'vitest'
import { buildRecordOrderBy, buildRecordWhere } from '#server/db/record-sql'
import { RECORD_COUNT_CAP } from '#shared/constants/record'
import { prisma } from '#server/db/prisma'
import { RecordService } from '#server/services/records'
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
 * The half `record-sql.spec.ts` cannot reach. That spec asserts on `.text` and `.values` and
 * never executes, so a fragment PostgreSQL rejects passes the whole unit suite. Everything here
 * runs the SQL for real and looks at which rows come back.
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
  const page = await RecordService.listRecords(tableId, fields, query({ filters, ...overrides }))
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

  /** `?|` over the stored array — the one comparison here a GIN index can serve. */
  it('matches a multi-value SELECT where the lists overlap', async () => {
    expect(await matching({ tags: ['urgent'] })).toEqual(['Beta', 'Acme'])
    expect(await matching({ tags: ['renewal'] })).toEqual(['Beta'])
  })

  it('leaves out a row whose list is empty', async () => {
    expect(await matching({ tags: ['urgent', 'renewal'] })).not.toContain('Gamma')
  })

  /**
   * A multi-value filter beside a **range**, the one neighbour contributing a bare two-term
   * `a >= x AND a <= y`. Beta carries `urgent` but falls outside the range, so it is the row
   * that appears if the conjunction has come apart.
   *
   * What this does *not* prove: `?|` binds tighter than `AND`, so precedence alone would keep it
   * correct unparenthesised. The parentheses keep the invariant visible, which no test can see.
   */
  it('composes with a bare range bound rather than widening it', async () => {
    expect(await matching({ tags: ['urgent'], contract_value: { from: 50, to: 200 } })).toEqual([
      'Acme',
    ])
  })

  it('ANDs several filters rather than widening', async () => {
    expect(await matching({ stage: ['Won'], active: true, company: 'a' })).toEqual([
      'Gamma',
      'Acme',
    ])
    expect(await matching({ stage: ['Won'], active: false })).toEqual([])
  })

  it('filters the record number as text, so 1 finds #1 but not #2', async () => {
    const page = await RecordService.listRecords(
      tableId,
      fields,
      query({ filters: { [RECORD_NUMBER_KEY]: '1' } }),
    )

    expect(page.records.map((record) => record.number)).toEqual([1])
  })

  /**
   * The `::date` cast on the timestamp columns. A range's bounds are dates, so an uncast
   * `createdAt <= '2026-01-05'` means *midnight* and every record made that day drops out of
   * its own filter. Only the database can answer this.
   *
   * Its own table, because the shared fixture's rows are all "now", and timestamps at **midday**
   * so `::date` reads as the same calendar day whatever offset the driver applies.
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

    const page = await RecordService.listRecords(
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
   * The bare number, not the `#` form: the projection is `"number"::text`, so `4` finds `#4`,
   * `#14` and `#42` alike. Its own table, because every date in the shared fixture contains a
   * digit and DATE is searched too.
   */
  it('matches the record number, which nothing else here carries', async () => {
    const table = await createTable((await createUser()).id)
    const textOnly = await createFields(table.id, [{ key: 'company', type: 'TEXT' }])
    await createRecords(table.id, [{ company: 'Alpha' }, { company: 'Beta' }, { company: 'Gamma' }])

    const page = await RecordService.listRecords(table.id, textOnly, query({ search: '2' }))

    expect(page.records.map((record) => record.number)).toEqual([2])
  })

  /**
   * The storage format must not leak into results: `matchesAnyElement` unnests through
   * `jsonb_array_elements_text` precisely so the brackets, quotes and commas are not searchable
   * text. Projecting with `->>` would still "work", with every term below matching rows.
   *
   * The separator is `", "`, not `","`: **jsonb normalises its text output**, so Beta's tags
   * render as `["renewal", "urgent"]`. A `","` probe passes even against the broken projection.
   *
   * Two characters and up, so each is a term the app could really submit.
   */
  it.each(['["', '", "', '"]'])(
    'does not match a multi SELECT on its JSON punctuation: %s',
    async (term) => {
      expect(await searching(term)).toEqual([])
    },
  )

  /**
   * RELATION opts out of search entirely — the stored value is a cuid, and matching the label
   * would pull the target table into the count query, which has no `LIMIT`. The positive half
   * keeps it honest: without it the case would pass against a table nothing could find.
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
      const page = await RecordService.listRecords(deals.id, dealFields, query({ search: term }))
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

  /**
   * A NUMBER is stored as a JSON **number** and searched through its un-cast text, so `100`
   * finds `1000`. Its own case because it is the one type whose searchability depends on how the
   * value is stored — a pre-filter flattening only strings would drop it silently.
   */
  it('matches a NUMBER through its text, so 100 also finds 1000', async () => {
    expect(await searching('100')).toEqual(['Gamma', 'Acme'])
  })
})

/**
 * `record_search_text` is the indexed **pre-filter**, and the per-type predicates decide after
 * it — which works only while it is a strict **superset** of what they can match. An
 * over-inclusive blob costs a row the OR group rejects; a value it *omits* is a row search can
 * never return, and nothing would report it.
 *
 * Asserted on the function's own output, so a gap is attributed to the flatten rather than to
 * whichever predicate happened to be exercised.
 */
describe('the search pre-filter flattens every stored value', () => {
  it('carries every scalar, every list element and the record number', async () => {
    const stored = {
      company: 'Acme',
      contract_value: 1250.5,
      active: true,
      signed_on: '2026-01-15',
      stage: 'Won',
      tags: ['urgent', 'renewal'],
      owner: 'cmsxxxxxxxxxxxxxxxxxxxxxx',
    }

    const rows = await prisma.$queryRaw<{ flattened: string }[]>`
      SELECT record_search_text(${stored}::jsonb, 42) AS flattened
    `
    const flattened = rows[0]?.flattened ?? ''

    // The record number, in the bare form its own predicate matches
    expect(flattened).toContain('42')
    // Every scalar, whatever its JSON type — numbers and booleans included, since the flatten
    // may over-reach but may never fall short
    expect(flattened).toContain('Acme')
    expect(flattened).toContain('1250.5')
    expect(flattened).toContain('true')
    expect(flattened).toContain('2026-01-15')
    expect(flattened).toContain('Won')
    expect(flattened).toContain('cmsxxxxxxxxxxxxxxxxxxxxxx')
    // A list contributes its elements…
    expect(flattened).toContain('urgent')
    expect(flattened).toContain('renewal')
    // …and never the punctuation holding them together, which would make `["` a search term
    expect(flattened).not.toContain('["')
    expect(flattened).not.toContain('", "')
  })

  it('degrades rather than erroring on a null value or an empty document', async () => {
    const [row] = await prisma.$queryRaw<{ a: string; b: string }[]>`
      SELECT record_search_text('{"company": null}'::jsonb, 1) AS a,
             record_search_text('{}'::jsonb, 2) AS b
    `

    expect(row?.a).toContain('1')
    expect(row?.b).toContain('2')
  })
})

/**
 * The count stops at `RECORD_COUNT_CAP`. The unit spec pins the arithmetic against a stub; this
 * pins that the `LIMIT` really stops PostgreSQL, and that a table on the cap reports exactly.
 */
describe('the record count is bounded', () => {
  const fill = (count: number) => prisma.$executeRaw`
    INSERT INTO "Record" ("id","tableId","number","data","createdAt","updatedAt")
    SELECT 'bulk'||g, ${tableId}, 5000+g, jsonb_build_object('company', 'Bulk ' || g), now(), now()
    FROM generate_series(1, ${count}) g
  `

  it('reports a table under the cap exactly', async () => {
    const page = await RecordService.listRecords(tableId, fields, query())

    // The three rows the shared fixture seeds
    expect(page).toMatchObject({ total: 3, totalCapped: false })
  })

  it('reports a table sitting exactly on the cap as exact, not capped', async () => {
    await fill(RECORD_COUNT_CAP - 3)

    const page = await RecordService.listRecords(tableId, fields, query())

    expect(page).toMatchObject({ total: RECORD_COUNT_CAP, totalCapped: false })
  })

  it('stops counting past the cap and says so', async () => {
    await fill(RECORD_COUNT_CAP)

    const page = await RecordService.listRecords(tableId, fields, query())

    expect(page).toMatchObject({ total: RECORD_COUNT_CAP, totalCapped: true })
    // The page itself is unaffected — the cap bounds the count, never the rows
    expect(page.records).toHaveLength(page.pageSize)
  })
})

/**
 * The plan assertion for search, for the reason the multi-value one above gives: an unused index
 * returns entirely correct rows, so every other test here passes while search scans the table.
 * The pre-filter expression and `Record_search_trgm_idx` are one contract.
 */
describe('free-text search is served by the trigram index', () => {
  it('uses the index and does not scan', async () => {
    // Seeded inside the case: `setup.ts` truncates in `beforeEach`, and an EXPLAIN over three
    // rows would prefer a scan and prove nothing
    await prisma.$executeRaw`
      INSERT INTO "Record" ("id","tableId","number","data","createdAt","updatedAt")
      SELECT 'seek'||g, ${tableId}, 1000+g,
             jsonb_build_object('company', 'Filler ' || g), now(), now()
      FROM generate_series(1, 20000) g
    `
    await prisma.$executeRaw`ANALYZE "Record"`

    const where = buildRecordWhere(tableId, fields, {}, 'zzqqxx')
    const rows = await prisma.$queryRaw<Record<string, string>[]>`
      EXPLAIN SELECT id FROM "Record" ${where}
    `
    const plan = rows.map((row) => Object.values(row)[0]).join('\n')

    expect(plan).toContain('Record_search_trgm_idx')
    expect(plan).not.toContain('Seq Scan')
  })
})

describe('ORDER BY', () => {
  const ordered = async (key: string, direction: 'asc' | 'desc') => {
    const page = await RecordService.listRecords(
      tableId,
      fields,
      query({ sort: { key, direction } }),
    )
    return page.records.map((record) => record.data.company)
  }

  it('sorts NUMBER numerically, so 9 comes before 100', async () => {
    expect(await ordered('contract_value', 'asc')).toEqual(['Beta', 'Acme', 'Gamma'])
  })

  it('sorts the record number as an integer', async () => {
    const page = await RecordService.listRecords(
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

  /**
   * A RELATION sorts by the target's **label**, through a join reading the outer row as
   * `"Record"`. Asserted **with and without** a search: the two build different `WHERE`s over
   * one join, so the same order either way proves the join composes with both.
   */
  it('sorts by a relation label whether or not a search is narrowing it', async () => {
    const user = await createUser()
    const people = await createTable(user.id, 'People')
    await createFields(people.id, [{ key: 'full_name', type: 'TEXT' }])
    const [ada, grace] = await createRecords(people.id, [
      { full_name: 'Ada Lovelace' },
      { full_name: 'Grace Hopper' },
    ])

    const deals = await createTable(user.id, 'Deals')
    const dealFields = await createFields(deals.id, [
      { key: 'company', type: 'TEXT' },
      {
        key: 'owner',
        type: 'RELATION',
        options: { targetTableId: people.id, labelFieldKey: 'full_name' },
      },
    ])
    await createRecords(deals.id, [
      { company: 'Zeta Holdings', owner: grace?.id ?? '' },
      { company: 'Alpha Holdings', owner: ada?.id ?? '' },
    ])

    const byOwner = async (search: string) => {
      const page = await RecordService.listRecords(
        deals.id,
        dealFields,
        query({ sort: { key: 'owner', direction: 'asc' }, search }),
      )
      return page.records.map((record) => record.data.company)
    }

    // Ada before Grace — the label's order, not the company's and not creation order
    expect(await byOwner('')).toEqual(['Alpha Holdings', 'Zeta Holdings'])
    expect(await byOwner('Holdings')).toEqual(['Alpha Holdings', 'Zeta Holdings'])
  })

  /**
   * The ordering reaches the target through a `LEFT JOIN`, and the three ways that goes wrong are
   * invisible in the SQL: a row vanishes, a row appears twice, or it falls back to a subquery.
   */
  describe('the join the relation ordering brings with it', () => {
    async function dealsLinkedTo(links: (string | undefined)[]) {
      const user = await createUser()
      const people = await createTable(user.id, 'People')
      await createFields(people.id, [{ key: 'full_name', type: 'TEXT' }])
      const [ada] = await createRecords(people.id, [{ full_name: 'Ada Lovelace' }])

      const deals = await createTable(user.id, 'Deals')
      const dealFields = await createFields(deals.id, [
        { key: 'company', type: 'TEXT' },
        {
          key: 'owner',
          type: 'RELATION',
          options: { targetTableId: people.id, labelFieldKey: 'full_name' },
        },
      ])
      await createRecords(
        deals.id,
        links.map((link, index) => ({
          company: `Deal ${index}`,
          owner: link === 'ada' ? (ada?.id ?? '') : (link ?? ''),
        })),
      )

      return { deals, dealFields }
    }

    const sorted = (deals: { id: string }, dealFields: IField[]) =>
      RecordService.listRecords(
        deals.id,
        dealFields,
        query({ sort: { key: 'owner', direction: 'asc' } }),
      )

    it('keeps a row whose link resolves to nothing, and sorts it last', async () => {
      // An inner join would drop these two entirely — the row would disappear from its own table
      const { deals, dealFields } = await dealsLinkedTo(['rec_deleted', undefined, 'ada'])

      const page = await sorted(deals, dealFields)

      expect(page.records).toHaveLength(3)
      expect(page.records[0]?.data.company).toBe('Deal 2')
    })

    it('returns each row once, however the join resolves', async () => {
      const { deals, dealFields } = await dealsLinkedTo(['ada', 'ada', 'ada'])

      const page = await sorted(deals, dealFields)

      // The join is on the target's primary key, so at most one row can match — but a join that
      // matched twice would silently duplicate rows rather than error
      expect(page.records).toHaveLength(3)
      expect(new Set(page.records.map((record) => record.id)).size).toBe(3)
      expect(page.total).toBe(3)
    })

    /**
     * The plan assertion: a correlated subquery, which PostgreSQL reports as a `SubPlan` and
     * runs once per row, returns identical rows to the join — so nothing else here would notice
     * a silent revert.
     */
    it('resolves the label by joining, not by a subquery per row', async () => {
      const { deals, dealFields } = await dealsLinkedTo(['ada'])
      const order = buildRecordOrderBy(dealFields, { key: 'owner', direction: 'asc' })
      const where = buildRecordWhere(deals.id, dealFields, {})

      const rows = await prisma.$queryRaw<Record<string, string>[]>`
        EXPLAIN SELECT id FROM "Record" ${order.join} ${where} ORDER BY ${order.orderBy} LIMIT 50
      `
      const plan = rows.map((row) => Object.values(row)[0]).join('\n')

      expect(plan).toContain('Join')
      expect(plan).not.toContain('SubPlan')
    })
  })
})

describe('paging and counting', () => {
  it('counts every matching row, not just the page', async () => {
    const page = await RecordService.listRecords(tableId, fields, query({ pageSize: 2 }))

    expect(page.records).toHaveLength(2)
    expect(page.total).toBe(3)
  })

  it('offsets to the next page', async () => {
    const page = await RecordService.listRecords(tableId, fields, query({ page: 2, pageSize: 2 }))

    expect(page.records).toHaveLength(1)
    expect(page.total).toBe(3)
  })

  it('counts what the filter matched, so the pager does not promise pages that are not there', async () => {
    const page = await RecordService.listRecords(
      tableId,
      fields,
      query({ filters: { stage: ['Won'] } }),
    )

    expect(page.total).toBe(2)
  })

  it('comes back empty past the end rather than erroring', async () => {
    const page = await RecordService.listRecords(tableId, fields, query({ page: 9 }))

    expect(page.records).toEqual([])
    expect(page.total).toBe(3)
  })
})

/**
 * The one case here that asserts on a **query plan** rather than on rows.
 *
 * An index that is present but unused returns entirely correct results, so it passes every suite
 * in the project and shows up only as latency under data volume none of them has — which is how
 * `jsonb_exists_any` was documented as GIN-indexable while never being so.
 *
 * Structural assertions only, never timings: `CLAUDE.md` §10 requires determinism.
 */
describe('the multi-value filter is GIN-indexable', () => {
  const INDEX = 'record_tags_gin_probe'

  it('is served by a GIN index on the same expression, and does not scan', async () => {
    // Seeded *inside* the case: `setup.ts` truncates in `beforeEach`, and an EXPLAIN against an
    // empty table passes while proving nothing
    await prisma.$executeRaw`
      INSERT INTO "Record" ("id","tableId","number","data","createdAt","updatedAt")
      SELECT 'probe'||g, ${tableId}, 1000+g, '{"tags":["urgent"]}'::jsonb, now(), now()
      FROM generate_series(1, 5000) g
    `
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX}`)
    await prisma.$executeRawUnsafe(`CREATE INDEX ${INDEX} ON "Record" USING gin ((data->'tags'))`)
    await prisma.$executeRaw`ANALYZE "Record"`

    try {
      // The production fragment, not a hand-written one — the point is that what the builder
      // emits is indexable, so a rewrite that loses the property fails here
      const where = buildRecordWhere(tableId, fields, { tags: ['renewal'] })
      const rows = await prisma.$queryRaw<Record<string, string>[]>`
        EXPLAIN SELECT id FROM "Record" ${where}
      `
      const plan = rows.map((row) => Object.values(row)[0]).join('\n')

      expect(plan).toContain(INDEX)
      expect(plan).not.toContain('Seq Scan')
    } finally {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${INDEX}`)
    }
  })
})

describe('table scoping', () => {
  it('never returns another table’s rows, even one owned by the same user', async () => {
    const page = await RecordService.listRecords(tableId, fields, query())
    expect(page.total).toBe(3)

    const other = await createTable((await createUser()).id)
    await createRecords(other.id, [{ company: 'Elsewhere' }])

    const again = await RecordService.listRecords(tableId, fields, query())
    expect(again.total).toBe(3)
    expect(again.records.map((record) => record.data.company)).not.toContain('Elsewhere')
  })
})
