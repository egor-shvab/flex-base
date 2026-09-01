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
  number: 4,
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
 * The rule these serve is `CLAUDE.md` §5: ownership is scoped *inside* the query, never checked
 * after the fact. Asserting on the argument rather than only the outcome is what makes that
 * testable — a fetch-then-compare rewrite would still return the right value.
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
 * A route may name its table by the public number or by the cuid older links use. Which column
 * identifies the row is all that differs — **the owner is inside the `where` either way**.
 */
describe('a table is addressable by number as well as by cuid', () => {
  const whereOf = () => prismaMock.table.findUnique.mock.calls[0]?.[0]?.where

  it('scopes a numeric address on the owner through the compound unique', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await requireOwnedTable(USER_ID, '4')

    expect(whereOf()).toEqual({ userId_number: { userId: USER_ID, number: 4 } })
  })

  it('still scopes a cuid address by id and owner', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await requireOwnedTable(USER_ID, TABLE_ID)

    expect(whereOf()).toEqual({ id: TABLE_ID, userId: USER_ID })
  })

  it('reads both forms the same way when fetching fields, and when fetching both', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...table, fields: [] })

    await requireOwnedTableFields(USER_ID, '4')
    await requireOwnedTableWithFields(USER_ID, '4')

    for (const call of prismaMock.table.findUnique.mock.calls) {
      expect(call[0]?.where).toEqual({ userId_number: { userId: USER_ID, number: 4 } })
    }
  })

  /**
   * A malformed address takes the id branch, where it matches nothing — the reason
   * `parseAddressNumber` answers `0` rather than `NaN`, which would make Prisma throw and turn
   * a mistyped link into a 500 where it owes a 404.
   */
  it.each([
    ['digits with a suffix', '12abc'],
    ['zero, which no row holds', '0'],
    ['nothing at all', ''],
    ['past a PostgreSQL Int', '9'.repeat(40)],
  ])('sends %s down the id branch, where it simply finds nothing', async (_case, address) => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireOwnedTable(USER_ID, address)).rejects.toMatchObject({ statusCode: 404 })
    expect(whereOf()).toEqual({ id: address, userId: USER_ID })
  })
})

/**
 * Another user's row and a missing row are the same answer: the scoped query cannot tell them
 * apart, and a 403 would confirm the resource exists. There is no separate "not yours" case
 * because the code has none.
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
   * It answers in the shape every layer above the database speaks: ISO strings here, `Date`s in
   * the stub above. Handing the row back type-checks only because `JSON.stringify` produces the
   * same text, and asserting the strings is what stops that being a coincidence.
   */
  it('hands the table back in the shape the wire carries, timestamps included', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await expect(requireOwnedTable(USER_ID, TABLE_ID)).resolves.toEqual({
      id: TABLE_ID,
      number: 4,
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

    const { fields } = await requireOwnedTableFields(USER_ID, TABLE_ID)

    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({ key: 'company', type: 'TEXT', options: null })
  })

  /**
   * The id is resolved rather than echoed: the address may have been a number, and every route
   * below builds its own `where` from what this returns.
   */
  it('answers with the table’s id, not with the address it was asked for', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ id: TABLE_ID, fields: [] })

    await expect(requireOwnedTableFields(USER_ID, '4')).resolves.toMatchObject({
      tableId: TABLE_ID,
    })
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

    const { fields } = await requireRecordFields(USER_ID, TABLE_ID)
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
