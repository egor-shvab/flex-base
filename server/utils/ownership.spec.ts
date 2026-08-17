import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  requireFieldTarget,
  requireOwnedTable,
  requireOwnedTableFields,
  requireOwnedTableWithFields,
  requireRecordFields,
} from '#server/utils/ownership'
import { fieldInputSchema, type TFieldInput } from '#shared/validation/field'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { textField } from '~~/test/fixtures'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const USER_ID = 'usr_1'
const TABLE_ID = 'tbl_deals'

/** A row as Prisma returns it — timestamps are `Date`s until a mapper turns them into the wire's. */
const table = {
  id: TABLE_ID,
  name: 'Deals',
  createdAt: new Date('2026-01-05T09:14:00.000Z'),
  updatedAt: new Date('2026-02-11T16:30:00.000Z'),
}

function relationInput(overrides: Partial<TFieldInput> = {}): TFieldInput {
  return fieldInputSchema.parse({
    name: 'Owner',
    type: 'RELATION',
    targetTableId: 'tbl_people',
    labelFieldKey: 'full_name',
    ...overrides,
  })
}

beforeEach(resetPrismaMock)

/**
 * The rule these all serve is `CLAUDE.md` §5: ownership is scoped *inside* the query, never
 * checked after the fact. Asserting on the argument rather than only on the outcome is what
 * makes that testable — a fetch-then-compare rewrite would still return the right value here
 * while losing the property the rule exists for.
 */
describe('ownership is scoped in the query', () => {
  it('asks for the table by id and owner together', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await requireOwnedTable(USER_ID, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TABLE_ID, userId: USER_ID } }),
    )
  })

  it('does the same when fetching the table’s fields', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ id: TABLE_ID, fields: [] })

    await requireOwnedTableFields(USER_ID, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TABLE_ID, userId: USER_ID } }),
    )
  })

  it('and when fetching both at once', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...table, fields: [] })

    await requireOwnedTableWithFields(USER_ID, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TABLE_ID, userId: USER_ID } }),
    )
  })

  it('reads the fields in stored order, which every caller depends on', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ id: TABLE_ID, fields: [] })

    await requireOwnedTableFields(USER_ID, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          fields: expect.objectContaining({ orderBy: { order: 'asc' } }),
        }),
      }),
    )
  })
})

/**
 * A row that exists but belongs to someone else and a row that does not exist are the same
 * answer — the scoped query cannot tell them apart, and that is the point: a 403 would confirm
 * the resource exists. There is no separate "not yours" case to test because the code has none.
 */
describe('another user’s row is indistinguishable from a missing one', () => {
  it('is a 404 from requireOwnedTable, never a 403', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireOwnedTable(USER_ID, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Table not found',
    })
  })

  it('is a 404 from requireOwnedTableFields', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireOwnedTableFields(USER_ID, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('is a 404 from requireOwnedTableWithFields', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireOwnedTableWithFields(USER_ID, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('what the helpers return', () => {
  /**
   * It answers in the shape every layer above the database speaks, not in the row's — the
   * timestamps are ISO strings here and `Date`s in the stub above. Handing the row back
   * type-checked only because `JSON.stringify` happened to produce the same text the response
   * type promised; asserting the strings is what stops that agreement being a coincidence.
   */
  it('hands the table back in the shape the wire carries, timestamps included', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await expect(requireOwnedTable(USER_ID, TABLE_ID)).resolves.toEqual({
      id: TABLE_ID,
      name: 'Deals',
      createdAt: '2026-01-05T09:14:00.000Z',
      updatedAt: '2026-02-11T16:30:00.000Z',
    })
  })

  it('narrows each field’s JSON options on the way out', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      id: TABLE_ID,
      fields: [{ ...textField('company'), options: null }],
    })

    const fields = await requireOwnedTableFields(USER_ID, TABLE_ID)

    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({ key: 'company', type: 'TEXT', options: null })
  })

  it('names the table alongside its fields, which the detail dialog needs', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...table, fields: [textField('company')] })

    const result = await requireOwnedTableWithFields(USER_ID, TABLE_ID)

    expect(result.table.name).toBe('Deals')
    expect(result.fields.map((field) => field.key)).toEqual(['company'])
  })
})

describe('requireFieldTarget', () => {
  it('has nothing to check for a type that stores no target', async () => {
    await requireFieldTarget(USER_ID, fieldInputSchema.parse({ name: 'Company', type: 'TEXT' }))

    expect(prismaMock.table.findUnique).not.toHaveBeenCalled()
  })

  it('accepts a label field the target table really has', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      id: 'tbl_people',
      fields: [textField('full_name')],
    })

    await expect(requireFieldTarget(USER_ID, relationInput())).resolves.toBeUndefined()
  })

  it('scopes the target table by owner too, so a relation cannot reach across accounts', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      id: 'tbl_people',
      fields: [textField('full_name')],
    })

    await requireFieldTarget(USER_ID, relationInput())

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tbl_people', userId: USER_ID } }),
    )
  })

  it('rejects a label field the target table does not have', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      id: 'tbl_people',
      fields: [textField('company')],
    })

    await expect(requireFieldTarget(USER_ID, relationInput())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field to show for the link',
    })
  })

  it('surfaces the 404 when the target table is not the user’s', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireFieldTarget(USER_ID, relationInput())).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('requireRecordFields', () => {
  it('passes the fields through when the table has some', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      id: TABLE_ID,
      fields: [textField('company')],
    })

    const fields = await requireRecordFields(USER_ID, TABLE_ID)
    expect(fields.map((field) => field.key)).toEqual(['company'])
  })

  it('refuses a table with no fields — there is no record shape to validate against', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ id: TABLE_ID, fields: [] })

    await expect(requireRecordFields(USER_ID, TABLE_ID)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'This table has no fields yet',
    })
  })

  it('still 404s for a table that is not the user’s, before it can be called empty', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireRecordFields(USER_ID, TABLE_ID)).rejects.toMatchObject({ statusCode: 404 })
  })
})
