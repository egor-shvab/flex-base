import { beforeEach, describe, expect, it } from 'vitest'
import recordsGet from '#server/api/tables/[tableAddress]/records/index.get'
import recordsPost from '#server/api/tables/[tableAddress]/records/index.post'
import recordGet from '#server/api/tables/[tableAddress]/records/[recordAddress].get'
import recordPatch from '#server/api/tables/[tableAddress]/records/[recordAddress].patch'
import { SEARCH_MIN_LENGTH } from '#shared/constants/filter'
import { MULTI_VALUE_MAX_ITEMS, RECORD_PAGE_SIZE_MAX } from '#shared/constants/record'
import type { IAuthUser } from '#shared/types/auth'
import { testEvent } from '~~/test/integration/event'
import { createField, createRecord, createTable, createUser } from '~~/test/integration/seed'

let ada: IAuthUser
let tableId: string
let peopleId: string

/** The endpoint's answer for a query string, as a browser would send it. */
function list(query: Record<string, string | string[]>) {
  return recordsGet(testEvent({ user: ada, params: { tableAddress: tableId }, query }))
}

const companies = async (query: Record<string, string | string[]>) =>
  (await list(query)).records.map((record) => record.data.company)

beforeEach(async () => {
  ada = await createUser()

  const people = await createTable(ada.id, 'People')
  peopleId = people.id
  await createField(peopleId, { key: 'full_name', type: 'TEXT' })

  const table = await createTable(ada.id, 'Deals')
  tableId = table.id

  await createField(tableId, { key: 'company', type: 'TEXT', order: 0 })
  await createField(tableId, { key: 'contract_value', type: 'NUMBER', order: 1 })
  await createField(tableId, {
    key: 'stage',
    type: 'SELECT',
    order: 2,
    options: {
      choices: [
        { value: 'Won', color: 'green' },
        { value: 'Lost', color: 'red' },
      ],
    },
  })
  await createField(tableId, {
    key: 'owner',
    type: 'RELATION',
    order: 3,
    options: { targetTableId: peopleId, labelFieldKey: 'full_name' },
  })

  await createRecord(tableId, { company: 'Acme', contract_value: 100, stage: 'Won' })
  await createRecord(tableId, { company: 'Beta', contract_value: 900, stage: 'Lost' })
})

/**
 * The endpoint decodes a link with the same codec the records page uses, over params its schema
 * validated first. Both halves are covered in isolation; only here is it true that the endpoint
 * composes them the way the page does, so a shared URL cannot mean two things.
 */
describe('reading a list query off the URL', () => {
  it('returns the whole table with no params', async () => {
    expect(await companies({})).toEqual(['Beta', 'Acme'])
  })

  it('reads a scalar filter from the bare field key', async () => {
    expect(await companies({ company: 'acm' })).toEqual(['Acme'])
  })

  it('reads a range from its two bounds', async () => {
    expect(await companies({ contract_value_from: '500' })).toEqual(['Beta'])
    expect(await companies({ contract_value_to: '500' })).toEqual(['Acme'])
  })

  it('reads a list from the field key repeated', async () => {
    expect(await companies({ stage: ['Won', 'Lost'] })).toEqual(['Beta', 'Acme'])
    expect(await companies({ stage: ['Won'] })).toEqual(['Acme'])
  })

  it('reads sort and direction', async () => {
    expect(await companies({ sort: 'company', dir: 'asc' })).toEqual(['Acme', 'Beta'])
    expect(await companies({ sort: 'company', dir: 'desc' })).toEqual(['Beta', 'Acme'])
  })

  it('reads a search term', async () => {
    expect(await companies({ search: 'bet' })).toEqual(['Beta'])
  })

  it('reads paging, and reports it back', async () => {
    const page = await list({ pageSize: '1', page: '2' })

    expect(page.records).toHaveLength(1)
    expect(page).toMatchObject({ page: 2, pageSize: 1, total: 2 })
  })

  it('treats an empty param as not filtered rather than as match-nothing', async () => {
    expect(await companies({ company: '' })).toEqual(['Beta', 'Acme'])
  })

  it('ignores a param the table has never heard of', async () => {
    expect(await companies({ ghost: 'x' })).toEqual(['Beta', 'Acme'])
  })

  it('resolves linked records for the rows on the page', async () => {
    const ada2 = await createRecord(peopleId, { full_name: 'Ada' })
    await createRecord(tableId, { company: 'Gamma', owner: ada2.id })

    const page = await list({ search: 'gamma' })
    const refs = Object.values(page.linkedRecords)[0]

    expect(refs).toEqual({ [ada2.id]: { number: ada2.number, label: 'Ada' } })
  })
})

describe('what the endpoint refuses', () => {
  const rejects = (query: Record<string, string | string[]>) =>
    expect(list(query)).rejects.toMatchObject({ statusCode: 400 })

  it('400s on an unknown sort key rather than silently ignoring it', async () => {
    await rejects({ sort: 'ghost' })
  })

  it('400s on a direction outside asc/desc', async () => {
    await rejects({ dir: 'sideways' })
  })

  it('400s on a malformed filter value', async () => {
    await rejects({ contract_value_from: 'not-a-number' })
  })

  it('400s on a SELECT value the field does not offer', async () => {
    await rejects({ stage: ['Nonexistent'] })
  })

  it('400s on a repeat of a filter that takes one value', async () => {
    await rejects({ company: ['a', 'b'] })
  })

  it('400s below the search floor', async () => {
    await rejects({ search: 'a'.repeat(SEARCH_MIN_LENGTH - 1) })
  })

  it('400s on a page below one', async () => {
    await rejects({ page: '0' })
  })

  /** No request may ask for a whole table, however large. */
  it(`caps pageSize at ${RECORD_PAGE_SIZE_MAX}`, async () => {
    await rejects({ pageSize: String(RECORD_PAGE_SIZE_MAX + 1) })
  })
})

describe('writing through the endpoint', () => {
  const write = (body: unknown) =>
    recordsPost(testEvent({ user: ada, params: { tableAddress: tableId }, method: 'POST', body }))

  it('creates a record and hands it back with its number', async () => {
    const { record } = await write({ company: 'Gamma' })

    expect(record).toMatchObject({ number: 3, data: expect.objectContaining({ company: 'Gamma' }) })
  })

  it('strips a key the table does not declare', async () => {
    const { record } = await write({ company: 'Gamma', smuggled: 'x' })

    expect(record.data).not.toHaveProperty('smuggled')
  })

  it('400s on a value of the wrong type, storing nothing', async () => {
    await expect(write({ contract_value: 'not-a-number' })).rejects.toMatchObject({
      statusCode: 400,
    })

    expect(await companies({})).toEqual(['Beta', 'Acme'])
  })

  it('400s on a SELECT value the field does not offer', async () => {
    await expect(write({ stage: 'Nonexistent' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400s on a relation id that does not exist', async () => {
    await expect(write({ owner: 'rec_forged' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('400s on a relation id belonging to another table', async () => {
    const stranger = await createRecord(tableId, { company: 'Not a person' })

    await expect(write({ owner: stranger.id })).rejects.toMatchObject({ statusCode: 400 })
  })

  /**
   * The update path through the handler rather than the service. Only this layer shows that the
   * **route params reach the right row** — everything below takes a `recordId` as an argument.
   */
  describe('updating one', () => {
    const patch = (recordAddress: string, body: unknown) =>
      recordPatch(
        testEvent({
          user: ada,
          params: { tableAddress: tableId, recordAddress },
          method: 'PATCH',
          body,
        }),
      )

    /**
     * The sibling assertion is the point. "Acme became Renamed" also passes when the handler
     * reaches for the first record of the table regardless of the id it was given; "and Beta did
     * not" is what fails on a mis-wired param.
     */
    it('updates the record the route names, and leaves its siblings alone', async () => {
      const { records } = await list({})
      const acme = records.find((row) => row.data.company === 'Acme')

      const { record } = await patch(acme!.id, { company: 'Renamed', contract_value: 100 })

      expect(record).toMatchObject({
        id: acme!.id,
        data: expect.objectContaining({ company: 'Renamed' }),
      })
      expect(await companies({})).toEqual(['Beta', 'Renamed'])
    })

    /** `data` is replaced wholesale, so a key the payload omits is cleared rather than kept. */
    it('replaces the record’s data rather than merging into it', async () => {
      const { records } = await list({})
      const acme = records.find((row) => row.data.company === 'Acme')

      const { record } = await patch(acme!.id, { company: 'Acme' })

      expect(record.data).toMatchObject({ company: 'Acme', contract_value: null })
    })

    /**
     * The create path proves the schema is built from the table's fields; this proves the update
     * path validates against the same one rather than trusting a body that already exists.
     */
    it('400s on a value of the wrong type, storing nothing', async () => {
      const { records } = await list({})
      const acme = records.find((row) => row.data.company === 'Acme')

      await expect(patch(acme!.id, { contract_value: 'not-a-number' })).rejects.toMatchObject({
        statusCode: 400,
      })

      expect(await companies({})).toEqual(['Beta', 'Acme'])
    })
  })

  /**
   * The two caps a multi-value field carries, at the layer returning the status code.
   * `shared/validation/record.spec.ts` proves zod rejects both; only here is it shown that the
   * rejection reaches the caller as a 400 rather than being swallowed or stored.
   *
   * Duplicates are **rejected rather than deduplicated**: a control cannot produce one, so a
   * repeat is a crafted payload, and dropping it quietly would put a `.transform()` in a layer
   * whose whole job is to judge.
   */
  describe('a multi-value field’s caps', () => {
    /** Widened on the table the fixture already built, so the rest of its shape is unchanged. */
    async function withTags() {
      await createField(tableId, {
        key: 'tags',
        type: 'SELECT',
        order: 4,
        options: {
          choices: [
            { value: 'urgent', color: 'red' },
            { value: 'renewal', color: 'blue' },
          ],
          multiple: true,
        },
      })
    }

    it('400s on a repeated value rather than quietly deduplicating it', async () => {
      await withTags()

      await expect(write({ company: 'Gamma', tags: ['urgent', 'urgent'] })).rejects.toMatchObject({
        statusCode: 400,
      })
      expect(await companies({})).toEqual(['Beta', 'Acme'])
    })

    it(`400s past ${MULTI_VALUE_MAX_ITEMS} values, and accepts exactly that many`, async () => {
      await createField(tableId, {
        key: 'many',
        type: 'SELECT',
        order: 5,
        options: {
          choices: Array.from({ length: MULTI_VALUE_MAX_ITEMS + 1 }, (_, index) => ({
            value: `c${index}`,
            color: 'gray' as const,
          })),
          multiple: true,
        },
      })

      const values = Array.from({ length: MULTI_VALUE_MAX_ITEMS + 1 }, (_, index) => `c${index}`)

      await expect(write({ company: 'TooMany', many: values })).rejects.toMatchObject({
        statusCode: 400,
      })

      // The cap itself is allowed, or the test would pass against an off-by-one floor
      const { record } = await write({
        company: 'AtTheCap',
        many: values.slice(0, MULTI_VALUE_MAX_ITEMS),
      })
      expect(record.data.many).toHaveLength(MULTI_VALUE_MAX_ITEMS)
    })
  })

  it('400s writing to a table with no fields, since there is no shape to validate against', async () => {
    const bare = await createTable(ada.id, 'Bare')

    await expect(
      recordsPost(
        testEvent({ user: ada, params: { tableAddress: bare.id }, method: 'POST', body: {} }),
      ),
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'This table has no fields yet' })
  })
})

describe('the detail endpoint', () => {
  it('carries the table and fields so the dialog can render away from its own page', async () => {
    const record = await createRecord(tableId, { company: 'Gamma' })

    const detail = await recordGet(
      testEvent({ user: ada, params: { tableAddress: tableId, recordAddress: record.id } }),
    )

    expect(detail.table).toMatchObject({ name: 'Deals' })
    expect(detail.fields.map((field) => field.key)).toEqual([
      'company',
      'contract_value',
      'stage',
      'owner',
    ])
    expect(detail.record.id).toBe(record.id)
  })

  it('404s for a record of another table', async () => {
    const other = await createTable(ada.id, 'Other')
    const record = await createRecord(other.id, {})

    await expect(
      recordGet(
        testEvent({ user: ada, params: { tableAddress: tableId, recordAddress: record.id } }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('404s patching a record of another table', async () => {
    const other = await createTable(ada.id, 'Other')
    await createField(other.id, { key: 'company', type: 'TEXT' })
    const record = await createRecord(other.id, {})

    await expect(
      recordPatch(
        testEvent({
          user: ada,
          params: { tableAddress: tableId, recordAddress: record.id },
          method: 'PATCH',
          body: { company: 'Beta' },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

/**
 * A record address is the number a URL carries or the cuid a relation stores. The number is
 * unique **within its table**, so the risk covered here is an address reaching across tables,
 * which the `tableId`-scoped compound unique prevents.
 */
describe('a record is addressable by its number as well as its cuid', () => {
  const detail = (recordAddress: string) =>
    recordGet(
      testEvent({ user: ada, params: { tableAddress: tableId, recordAddress: recordAddress } }),
    )

  it('reads the same record either way', async () => {
    const { records } = await list({})
    const first = records[0]!

    const byNumber = await detail(String(first.number))
    const byCuid = await detail(first.id)

    expect(byNumber).toEqual(byCuid)
    expect(byNumber.record.id).toBe(first.id)
  })

  it('writes through a number, and the change is on the row that number names', async () => {
    const { records } = await list({})
    const target = records[0]!

    await recordPatch(
      testEvent({
        user: ada,
        params: { tableAddress: tableId, recordAddress: String(target.number) },
        method: 'PATCH',
        body: { company: 'Renamed', contract_value: 100, stage: 'Won', owner: null },
      }),
    )

    const { record } = await detail(target.id)
    expect(record.data.company).toBe('Renamed')
  })

  /** Numbers restart per table, so the same address is a different record in each. */
  it('does not reach across tables — record 1 of one is not record 1 of another', async () => {
    await createRecord(peopleId, { full_name: 'Ada' })

    const inDeals = await detail('1')
    const inPeople = await recordGet(
      testEvent({ user: ada, params: { tableAddress: peopleId, recordAddress: '1' } }),
    )

    expect(inDeals.record.id).not.toBe(inPeople.record.id)
    expect(inDeals.record.data.company).toBe('Acme')
    expect(inPeople.record.data.full_name).toBe('Ada')
  })

  it('404s on a number this table has no record for', async () => {
    await expect(detail('9999')).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Record not found',
    })
  })
})
