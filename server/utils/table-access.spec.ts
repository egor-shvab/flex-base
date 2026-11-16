import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertRecordAction,
  assertTableHasFields,
  requireFieldTarget,
  requireWorkspaceTable,
  requireWorkspaceTableFields,
  requireWorkspaceTableWithFields,
} from '#server/utils/table-access'
import { FULL_TABLE_ACCESS } from '#shared/constants/workspace'
import { fieldInputSchema, type TFieldInput } from '#shared/validation/field'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { asMultiple, relationField, selectField, textField } from '~~/test/fixtures'
import { buildMembership, buildRecordDefaults, MEMBERSHIP_WORKSPACE_ID } from '~~/test/membership'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const WORKSPACE_ID = MEMBERSHIP_WORKSPACE_ID
const TABLE_ID = 'tbl_deals'

const editorDefaults = buildRecordDefaults({ canCreate: true, updateScope: 'ALL' })
const member = buildMembership([], { recordDefaults: editorDefaults })

const table = {
  roleAccess: [],
  id: TABLE_ID,
  number: 4,
  name: 'Deals',
  createdAt: new Date('2026-01-05T09:14:00.000Z'),
  updatedAt: new Date('2026-02-11T16:30:00.000Z'),
}

/** A field as Prisma returns it: `updatedAt` is a Date until the mapper reads it. */
const stored = <T extends object>(field: T) => ({
  ...field,
  updatedAt: new Date('2026-02-11T16:30:00.000Z'),
})

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

describe('the workspace is scoped in the query', () => {
  it('asks for the table by id and workspace together', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await requireWorkspaceTable(member, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TABLE_ID, workspaceId: WORKSPACE_ID } }),
    )
  })

  it('does the same when fetching the table’s fields', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ roleAccess: [], id: TABLE_ID, fields: [] })

    await requireWorkspaceTableFields(member, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TABLE_ID, workspaceId: WORKSPACE_ID } }),
    )
  })

  it('and when fetching both at once', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...table, fields: [] })

    await requireWorkspaceTableWithFields(member, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TABLE_ID, workspaceId: WORKSPACE_ID } }),
    )
  })

  it('reads the fields in stored order, creation breaking a tie, which every caller depends on', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ roleAccess: [], id: TABLE_ID, fields: [] })

    await requireWorkspaceTableFields(member, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          fields: expect.objectContaining({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
        }),
      }),
    )
  })
})

describe('a table is addressable by number as well as by cuid', () => {
  const whereOf = () => prismaMock.table.findUnique.mock.calls[0]?.[0]?.where

  it('scopes a numeric address on the workspace through the compound unique', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await requireWorkspaceTable(member, '4')

    expect(whereOf()).toEqual({ workspaceId_number: { workspaceId: WORKSPACE_ID, number: 4 } })
  })

  it('resolves a slugged address by its leading number', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await requireWorkspaceTable(member, '4-deals')

    expect(whereOf()).toEqual({ workspaceId_number: { workspaceId: WORKSPACE_ID, number: 4 } })
  })

  it('still scopes a cuid address by id and workspace', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await requireWorkspaceTable(member, TABLE_ID)

    expect(whereOf()).toEqual({ id: TABLE_ID, workspaceId: WORKSPACE_ID })
  })

  it('reads both forms the same way when fetching fields, and when fetching both', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...table, fields: [] })

    await requireWorkspaceTableFields(member, '4')
    await requireWorkspaceTableWithFields(member, '4')

    for (const call of prismaMock.table.findUnique.mock.calls) {
      expect(call[0]?.where).toEqual({
        workspaceId_number: { workspaceId: WORKSPACE_ID, number: 4 },
      })
    }
  })

  it.each([
    ['digits with a suffix', '12abc'],
    ['zero, which no row holds', '0'],
    ['nothing at all', ''],
    ['past a PostgreSQL Int', '9'.repeat(40)],
  ])('sends %s down the id branch, where it simply finds nothing', async (_case, address) => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireWorkspaceTable(member, address)).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(whereOf()).toEqual({ id: address, workspaceId: WORKSPACE_ID })
  })
})

describe('another user’s row is indistinguishable from a missing one', () => {
  it('is a 404 from requireWorkspaceTable, never a 403', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireWorkspaceTable(member, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Table not found',
    })
  })

  it('is a 404 from requireWorkspaceTableFields', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireWorkspaceTableFields(member, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('is a 404 from requireWorkspaceTableWithFields', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireWorkspaceTableWithFields(member, TABLE_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('what the helpers return', () => {
  it('hands the table back in the shape the wire carries, timestamps included', async () => {
    prismaMock.table.findUnique.mockResolvedValue(table)

    await expect(requireWorkspaceTable(member, TABLE_ID)).resolves.toEqual({
      table: {
        id: TABLE_ID,
        number: 4,
        name: 'Deals',
        createdAt: '2026-01-05T09:14:00.000Z',
        updatedAt: '2026-02-11T16:30:00.000Z',
      },
      access: editorDefaults,
    })
  })

  it('narrows each field’s JSON options on the way out', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      roleAccess: [],
      id: TABLE_ID,
      fields: [stored({ ...textField('company'), options: null })],
    })

    const { fields } = await requireWorkspaceTableFields(member, TABLE_ID)

    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({ key: 'company', type: 'TEXT', options: null })
  })

  it('answers with the table’s id, not with the address it was asked for', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ roleAccess: [], id: TABLE_ID, fields: [] })

    await expect(requireWorkspaceTableFields(member, '4')).resolves.toMatchObject({
      tableId: TABLE_ID,
    })
  })

  it('names the table alongside its fields, which the detail dialog needs', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      ...table,
      fields: [stored(textField('company'))],
    })

    const result = await requireWorkspaceTableWithFields(member, TABLE_ID)

    expect(result.table.name).toBe('Deals')
    expect(result.fields.map((field) => field.key)).toEqual(['company'])
  })
})

describe('requireFieldTarget', () => {
  it('has nothing to check for a type that stores no target', async () => {
    await requireFieldTarget(member, fieldInputSchema.parse({ name: 'Company', type: 'TEXT' }))

    expect(prismaMock.table.findUnique).not.toHaveBeenCalled()
  })

  it('accepts a label field the target table really has', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      roleAccess: [],
      id: 'tbl_people',
      fields: [stored(textField('full_name'))],
    })

    await expect(requireFieldTarget(member, relationInput())).resolves.toBeUndefined()
  })

  it.each([
    ['a bare number', '4'],
    ['a slugged address', '4-people'],
  ])('refuses %s as a target rather than resolving it', async (_case, targetTableId) => {
    await expect(
      requireFieldTarget(member, relationInput({ targetTableId })),
    ).rejects.toMatchObject({ statusCode: 404 })

    expect(prismaMock.table.findUnique).not.toHaveBeenCalled()
  })

  it('scopes the target table by workspace too, so a relation cannot reach across workspaces', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      roleAccess: [],
      id: 'tbl_people',
      fields: [stored(textField('full_name'))],
    })

    await requireFieldTarget(member, relationInput())

    expect(prismaMock.table.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tbl_people', workspaceId: WORKSPACE_ID } }),
    )
  })

  it('rejects a label field the target table does not have', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      roleAccess: [],
      id: 'tbl_people',
      fields: [stored(textField('company'))],
    })

    await expect(requireFieldTarget(member, relationInput())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown field to show for the link',
    })
  })

  it('refuses another relation as the label, which would show a cuid', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      roleAccess: [],
      id: 'tbl_people',
      fields: [stored({ ...relationField(), key: 'full_name' })],
    })

    await expect(requireFieldTarget(member, relationInput())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'That field cannot be shown for a link: choose a single-value field',
    })
  })

  it('refuses a multi-value label field too', async () => {
    prismaMock.table.findUnique.mockResolvedValue({
      roleAccess: [],
      id: 'tbl_people',
      fields: [stored({ ...asMultiple(selectField()), key: 'full_name' })],
    })

    await expect(requireFieldTarget(member, relationInput())).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('surfaces the 404 when the target table is not the user’s', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null)

    await expect(requireFieldTarget(member, relationInput())).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('the caller’s access to the table', () => {
  const hidden = buildRecordDefaults({ readScope: 'NONE' })

  it('reads the caller’s role’s row for the table in the same query', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...table, fields: [] })

    await requireWorkspaceTable(member, TABLE_ID)
    await requireWorkspaceTableFields(member, TABLE_ID)

    expect(prismaMock.table.findUnique).toHaveBeenCalledTimes(2)
    for (const call of prismaMock.table.findUnique.mock.calls) {
      expect(call[0]?.select).toMatchObject({
        roleAccess: { where: { roleId: member.role.id } },
      })
    }
  })

  it('falls back to the role’s defaults without a row, and takes the row when there is one', async () => {
    const narrower = buildRecordDefaults({ deleteScope: 'ALL' })

    prismaMock.table.findUnique.mockResolvedValueOnce(table)
    await expect(requireWorkspaceTable(member, TABLE_ID)).resolves.toMatchObject({
      access: editorDefaults,
    })

    prismaMock.table.findUnique.mockResolvedValueOnce({ ...table, roleAccess: [narrower] })
    await expect(requireWorkspaceTable(member, TABLE_ID)).resolves.toMatchObject({
      access: narrower,
    })
  })

  it('answers a table hidden from the role with the same 404 as a missing one', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...table, roleAccess: [hidden], fields: [] })

    for (const lookup of [
      requireWorkspaceTable,
      requireWorkspaceTableFields,
      requireWorkspaceTableWithFields,
    ]) {
      await expect(lookup(member, TABLE_ID)).rejects.toMatchObject({
        statusCode: 404,
        statusMessage: 'Table not found',
      })
    }
  })

  it('hides a table from a role whose default is to see none', async () => {
    const blind = buildMembership([], { recordDefaults: hidden })
    prismaMock.table.findUnique.mockResolvedValue(table)

    await expect(requireWorkspaceTable(blind, TABLE_ID)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('opens a hidden table to the owner and to a schema manager', async () => {
    const owner = buildMembership([], { isOwner: true })
    const manager = buildMembership(['TABLES_MANAGE'], { recordDefaults: hidden })
    prismaMock.table.findUnique.mockResolvedValue({ ...table, roleAccess: [hidden] })

    await expect(requireWorkspaceTable(owner, TABLE_ID)).resolves.toMatchObject({
      access: FULL_TABLE_ACCESS,
    })
    await expect(requireWorkspaceTable(manager, TABLE_ID)).resolves.toMatchObject({
      access: { ...hidden, readScope: 'ALL' },
    })
  })
})

describe('assertRecordAction', () => {
  it('passes an action the table’s access allows', () => {
    expect(() => assertRecordAction(editorDefaults, 'create')).not.toThrow()
    expect(() => assertRecordAction(editorDefaults, 'update')).not.toThrow()
  })

  it('403s one it does not, naming it', () => {
    expect(() => assertRecordAction(editorDefaults, 'delete')).toThrow(
      expect.objectContaining({
        statusCode: 403,
        statusMessage: "You don't have permission to delete records in this table",
      }),
    )
  })
})

describe('assertTableHasFields', () => {
  it('passes a table with fields', () => {
    expect(() => assertTableHasFields([textField('company')])).not.toThrow()
  })

  it('refuses a table with no fields — there is no record shape to validate against', () => {
    expect(() => assertTableHasFields([])).toThrow(
      expect.objectContaining({ statusCode: 400, statusMessage: 'This table has no fields yet' }),
    )
  })
})
