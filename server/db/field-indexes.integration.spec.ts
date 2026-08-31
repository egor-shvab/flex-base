import { beforeEach, describe, expect, it } from 'vitest'
import {
  dropFieldIndexes,
  fieldIndexStats,
  reconcileFieldIndexes,
  syncFieldIndexes,
} from '#server/db/field-indexes'
import { prisma } from '#server/db/prisma'
import { buildRecordOrderBy, buildRecordWhere } from '#server/db/record-sql'
import { RecordService } from '#server/services/records'
import { DEFAULT_SORT_DIRECTION, DEFAULT_SORT_KEY } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'
import type { TRecordFilterValues, TSortDirection } from '#shared/types/filter'
import type { IRecordQuery } from '#shared/types/record'
import { createFields, createTable, createUser } from '~~/test/integration/seed'

/**
 * The half the unit spec cannot reach. It asserts the statements; this executes them and then
 * asks the planner whether it will use what they built.
 *
 * **That question is the point of this file.** The index expression inlines the field key while
 * the query binds it, so the two are generated separately and could drift apart — at which point
 * every row still comes back correct and only the speed is gone. Nothing else in the suite would
 * notice.
 */

let tableId: string

/** Enough rows that an index beats a scan, with one rare value per column to seek. */
async function seedRows(count = 20000) {
  await prisma.$executeRaw`
    INSERT INTO "Record" ("id","tableId","number","data","createdAt","updatedAt")
    SELECT 'idx'||g, ${tableId}, g,
           jsonb_build_object(
             'company', CASE WHEN g = 1 THEN 'Zzqqxx Unique' ELSE 'Filler ' || g END,
             'contract_value', g,
             'stage', CASE WHEN g = 1 THEN 'Won' ELSE 'Lost' END,
             'tags', CASE WHEN g = 1 THEN '["unicorn"]'::jsonb ELSE '["common"]'::jsonb END
           ),
           now(), now()
    FROM generate_series(1, ${count}) g
  `
  await prisma.$executeRaw`ANALYZE "Record"`
}

const query = (overrides: Partial<IRecordQuery> = {}): IRecordQuery => ({
  page: 1,
  pageSize: 50,
  sort: { key: DEFAULT_SORT_KEY, direction: DEFAULT_SORT_DIRECTION },
  filters: {},
  search: '',
  ...overrides,
})

/** The plan for the production WHERE of one filter. */
async function planForFilter(fields: IField[], filters: TRecordFilterValues): Promise<string> {
  const where = buildRecordWhere(tableId, fields, filters)
  const rows = await prisma.$queryRaw<Record<string, string>[]>`
    EXPLAIN SELECT id FROM "Record" ${where}
  `
  return rows.map((row) => Object.values(row)[0]).join('\n')
}

/**
 * The plan for the production ORDER BY of one field, **with sorting made expensive**.
 *
 * The filter cases above assert the index is *chosen*, which is the stronger claim. An ordering
 * cannot: whether an index beats sorting the rows outright depends on how many there are, so at
 * a size a test can afford the planner may quite correctly sort instead — and asserting
 * otherwise would only pin the row count.
 *
 * What matters here is that the index is **usable**: that the expression it was built on matches
 * the one the query emits, which is the thing that silently breaks. `SET LOCAL enable_sort`
 * removes the alternative and asks exactly that question. It has to run inside a transaction, or
 * the setting lands on whichever pooled connection took it and not on the `EXPLAIN`.
 */
async function planForSort(
  fields: IField[],
  key: string,
  direction: TSortDirection = DEFAULT_SORT_DIRECTION,
): Promise<string> {
  const where = buildRecordWhere(tableId, fields, {})
  const orderBy = buildRecordOrderBy(fields, { key, direction })

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL enable_sort = off`
    const rows = await tx.$queryRaw<Record<string, string>[]>`
      EXPLAIN SELECT id FROM "Record" ${where} ORDER BY ${orderBy} LIMIT 50
    `
    return rows.map((row) => Object.values(row)[0]).join('\n')
  })
}

/** Whether any owned index has recorded a scan yet, waiting out the statistics flush. */
async function waitForScan(attempts = 40): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await prisma.$executeRaw`SELECT pg_stat_clear_snapshot()`
    if ((await fieldIndexStats()).some((stat) => stat.scans > 0)) return true
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return false
}

const indexNames = async () => {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT c.relname AS name FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    WHERE c.relname LIKE 'rec_idx_%'
  `
  return rows.map((row) => row.name).sort()
}

beforeEach(async () => {
  // `test/integration/setup.ts` truncates rows, but an index is a schema object and survives
  // that — so without this every case inherits the last one's indexes
  for (const name of await indexNames()) {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${name}"`)
  }

  const user = await createUser()
  const table = await createTable(user.id)
  tableId = table.id
})

describe('a declared index is one the planner actually uses', () => {
  it('serves a TEXT filter from its trigram, and its ordering from its B-tree', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])
    await seedRows()
    await syncFieldIndexes(company as IField)
    await prisma.$executeRaw`ANALYZE "Record"`

    const fields = [company as IField]

    const filterPlan = await planForFilter(fields, { company: 'Zzqqxx' })
    expect(filterPlan).toContain(`rec_idx_${company?.id}_f`)
    expect(filterPlan).not.toContain('Seq Scan')

    // The default direction is descending, and that is deliberately its own index: a B-tree
    // reversed gives NULLS FIRST, which is not the ordering the app asks for
    const sortPlan = await planForSort(fields, 'company')
    expect(sortPlan).toContain(`rec_idx_${company?.id}_sd`)
  }, 60_000)

  it('serves an ascending sort from the ascending index, not the descending one', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])
    await seedRows()
    await syncFieldIndexes(company as IField)
    await prisma.$executeRaw`ANALYZE "Record"`

    const plan = await planForSort([company as IField], 'company', 'asc')

    expect(plan).toContain(`rec_idx_${company?.id}_sa`)
  }, 60_000)

  it('serves a NUMBER range from the one B-tree that covers both its filter and its sort', async () => {
    const [value] = await createFields(tableId, [
      { key: 'contract_value', type: 'NUMBER', indexed: true },
    ])
    await seedRows()
    await syncFieldIndexes(value as IField)
    await prisma.$executeRaw`ANALYZE "Record"`

    const fields = [value as IField]
    const plan = await planForFilter(fields, { contract_value: { from: 1, to: 5 } })

    // Either of this field's B-trees serves a range — they hold the same expression and differ
    // only in the order they store it, which a bounded scan does not care about. Asserting a
    // particular one would pin a planner preference rather than the property that matters.
    expect(plan).toContain(`rec_idx_${value?.id}_`)
    expect(plan).not.toContain('Seq Scan')
  }, 60_000)

  it('serves a widened SELECT from a GIN on the sub-path', async () => {
    const [tags] = await createFields(tableId, [
      {
        key: 'tags',
        type: 'SELECT',
        indexed: true,
        options: { choices: [{ value: 'unicorn', color: 'red' }], multiple: true },
      },
    ])
    await seedRows()
    await syncFieldIndexes(tags as IField)
    await prisma.$executeRaw`ANALYZE "Record"`

    const plan = await planForFilter([tags as IField], { tags: ['unicorn'] })

    expect(plan).toContain(`rec_idx_${tags?.id}_f`)
    expect(plan).not.toContain('Seq Scan')
  }, 60_000)
})

describe('the index lifecycle', () => {
  it('creates nothing while the field is opted out, and creates on opt-in', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT' }])

    await syncFieldIndexes(company as IField)
    expect(await indexNames()).toEqual([])

    await syncFieldIndexes({ ...(company as IField), indexed: true })
    expect(await indexNames()).toEqual([
      `rec_idx_${company?.id}_f`,
      `rec_idx_${company?.id}_sa`,
      `rec_idx_${company?.id}_sd`,
    ])
  }, 60_000)

  it('drops them again when the field is opted back out', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])

    await syncFieldIndexes(company as IField)
    expect(await indexNames()).toHaveLength(3)

    await syncFieldIndexes({ ...(company as IField), indexed: false })
    expect(await indexNames()).toEqual([])
  }, 60_000)

  it('drops everything a field owns when it is deleted', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])
    await syncFieldIndexes(company as IField)

    await dropFieldIndexes(company?.id ?? '')

    expect(await indexNames()).toEqual([])
  }, 60_000)

  /**
   * The failure mode `IF NOT EXISTS` would otherwise make permanent: a `CONCURRENTLY` build that
   * fails leaves an **invalid** index behind, which costs every write, serves no read, and looks
   * present enough that a rebuild would skip it forever.
   */
  it('replaces an invalid index rather than leaving it in place', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])
    await syncFieldIndexes(company as IField)

    // Mark one invalid, exactly as an interrupted concurrent build would leave it
    const name = `rec_idx_${company?.id}_f`
    await prisma.$executeRaw`
      UPDATE pg_index SET indisvalid = false
      WHERE indexrelid = ${name}::regclass
    `
    expect(await invalidCount()).toBe(1)

    await syncFieldIndexes(company as IField)

    expect(await invalidCount()).toBe(0)
    expect(await indexNames()).toContain(name)
  }, 60_000)

  /**
   * The diagnostic half. An index that is never scanned returns entirely correct results, so the
   * only way to notice it is costing writes for nothing is to ask PostgreSQL — which is what
   * these two exist for.
   */
  it('reports what each index has cost and returned, and which field owns it', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])
    await syncFieldIndexes(company as IField)

    const stats = await fieldIndexStats()

    expect(stats.map((stat) => stat.name)).toEqual([
      `rec_idx_${company?.id}_f`,
      `rec_idx_${company?.id}_sa`,
      `rec_idx_${company?.id}_sd`,
    ])
    // The cuid is recovered from the name, which is the only place the ownership is recorded
    expect(new Set(stats.map((stat) => stat.fieldId))).toEqual(new Set([company?.id]))
    expect(stats.every((stat) => stat.valid)).toBe(true)
    // Freshly built and never queried — exactly the shape that says "opt this back out"
    expect(stats.every((stat) => stat.scans === 0)).toBe(true)
    expect(stats.every((stat) => stat.bytes > 0)).toBe(true)
  }, 60_000)

  it('counts a scan once the index has actually served a query', async () => {
    const [value] = await createFields(tableId, [
      { key: 'contract_value', type: 'NUMBER', indexed: true },
    ])
    // The same size and filter the case above proves the planner serves from this index — a
    // smaller table would have it quite reasonably scan instead, and this case would then be
    // measuring the planner rather than the statistics plumbing it exists to check
    await seedRows()
    await syncFieldIndexes(value as IField)
    await prisma.$executeRaw`ANALYZE "Record"`

    await RecordService.listRecords(
      tableId,
      [value as IField],
      query({ filters: { contract_value: { from: 1, to: 5 } } }),
    )

    // **Polled, and that is not flakiness being papered over.** A backend reports index usage
    // to the shared statistics no more often than once a second, and a session caches the
    // snapshot it reads — so the counter is genuinely not there yet the instant the query
    // returns. Measured directly: zero immediately, one after a second. Waiting a fixed second
    // would be slower and no more certain.
    const scanned = await waitForScan()

    expect(scanned).toBe(true)
  }, 60_000)

  it('reports an invalid index as invalid, which nothing else surfaces', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])
    await syncFieldIndexes(company as IField)

    await prisma.$executeRaw`
      UPDATE pg_index SET indisvalid = false
      WHERE indexrelid = ${`rec_idx_${company?.id}_f`}::regclass
    `

    const stats = await fieldIndexStats()

    expect(stats.filter((stat) => !stat.valid).map((stat) => stat.name)).toEqual([
      `rec_idx_${company?.id}_f`,
    ])
  }, 60_000)

  it('says what a reconcile changed, telling a failed build apart from a tidy-up', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])

    const first = await reconcileFieldIndexes()
    expect(first.created).toHaveLength(3)
    expect(first).toMatchObject({ dropped: [], reaped: [] })

    // A second pass has nothing to do — the report is what makes that visible
    expect(await reconcileFieldIndexes()).toEqual({ created: [], dropped: [], reaped: [] })

    // A failed concurrent build, and a field that no longer wants its indexes: both are removed,
    // and they are reported apart because only one of them still needs doing
    await prisma.$executeRaw`
      UPDATE pg_index SET indisvalid = false
      WHERE indexrelid = ${`rec_idx_${company?.id}_f`}::regclass
    `
    const repaired = await reconcileFieldIndexes()
    expect(repaired.reaped).toEqual([`rec_idx_${company?.id}_f`])
    expect(repaired.created).toEqual([`rec_idx_${company?.id}_f`])
    expect(repaired.dropped).toEqual([])

    await prisma.field.update({ where: { id: company?.id }, data: { indexed: false } })
    const cleared = await reconcileFieldIndexes()
    expect(cleared.dropped).toHaveLength(3)
    expect(cleared).toMatchObject({ created: [], reaped: [] })
  }, 60_000)

  it('reconciles the whole database, dropping what no field wants', async () => {
    const [company] = await createFields(tableId, [{ key: 'company', type: 'TEXT', indexed: true }])
    await syncFieldIndexes(company as IField)
    expect(await indexNames()).toHaveLength(3)

    // Opt the field out behind the reconciler's back, the way drift actually happens
    await prisma.field.update({ where: { id: company?.id }, data: { indexed: false } })
    await reconcileFieldIndexes()

    expect(await indexNames()).toEqual([])
  }, 60_000)
})

async function invalidCount(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    WHERE c.relname LIKE 'rec_idx_%' AND NOT i.indisvalid
  `
  return rows[0]?.count ?? 0
}
