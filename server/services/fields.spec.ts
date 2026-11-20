import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import { Prisma } from '#server/generated/prisma/client'
import { FieldService, MAX_TABLE_FIELDS } from '#server/services/fields'
import { fieldInputSchema, type TFieldInput } from '#shared/validation/field'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { textField } from '~~/test/fixtures'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const TABLE_ID = 'tbl_deals'
const FIELD_ID = 'fld_owner'

type TFieldDraft = z.input<typeof fieldInputSchema>

function input(overrides: Partial<TFieldDraft> & Pick<TFieldDraft, 'type'>): TFieldInput {
  return fieldInputSchema.parse({ name: 'Owner', ...overrides })
}

const relation = (overrides: Partial<TFieldDraft> = {}) =>
  input({ type: 'RELATION', targetTableId: 'tbl_people', labelFieldKey: 'full_name', ...overrides })

const select = (overrides: Partial<TFieldDraft> = {}) =>
  input({ type: 'SELECT', choices: [{ value: 'Won' }], ...overrides })

function storedField(overrides: Partial<{ key: string; type: string; options: unknown }> = {}) {
  return { key: 'owner', type: 'RELATION', options: null, ...overrides }
}

beforeEach(resetPrismaMock)

const READ_AT = new Date('2026-02-11T16:30:00.000Z')

/** A field as Prisma returns it: `updatedAt` is a Date until the mapper reads it. */
const stored = <T extends object>(field: T) => ({ ...field, updatedAt: READ_AT })

describe('FieldService.buildOptions', () => {
  it('stores a SELECT’s choices and its cardinality', () => {
    expect(
      FieldService.buildOptions(select({ choices: [{ value: 'Won' }, { value: 'Lost' }] })),
    ).toEqual({
      choices: [
        { value: 'Won', color: 'gray' },
        { value: 'Lost', color: 'gray' },
      ],
      multiple: false,
    })
  })

  it('stores a RELATION’s target, label field and cardinality', () => {
    expect(FieldService.buildOptions(relation({ multiple: true }))).toEqual({
      targetTableId: 'tbl_people',
      labelFieldKey: 'full_name',
      multiple: true,
    })
  })

  it('writes a JSON null for a type that carries no options at all', () => {
    for (const type of ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE'] as const) {
      expect(FieldService.buildOptions(input({ type }))).toBe(Prisma.JsonNull)
    }
  })
})

describe('createField — order allocation', () => {
  it('starts an empty table at zero', async () => {
    prismaMock.field.findMany.mockResolvedValue([])
    prismaMock.field.create.mockResolvedValue(stored(textField('owner')))

    await FieldService.createField(TABLE_ID, input({ type: 'TEXT' }))

    expect(prismaMock.field.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 0 }) }),
    )
  })

  it('appends past the highest existing order, not past the count', async () => {
    prismaMock.field.findMany.mockResolvedValue([
      { key: 'a', type: 'TEXT', order: 0 },
      { key: 'b', type: 'TEXT', order: 7 },
    ])
    prismaMock.field.create.mockResolvedValue(stored(textField('owner')))

    await FieldService.createField(TABLE_ID, input({ type: 'TEXT' }))

    expect(prismaMock.field.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 8 }) }),
    )
  })

  it('derives the key from the name, against the keys already taken', async () => {
    prismaMock.field.findMany.mockResolvedValue([{ key: 'owner', type: 'TEXT', order: 0 }])
    prismaMock.field.create.mockResolvedValue(stored(textField('owner_2')))

    await FieldService.createField(TABLE_ID, input({ type: 'TEXT' }))

    expect(prismaMock.field.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: 'owner_2' }) }),
    )
  })

  it('maps a duplicate name onto a 409 rather than leaking the constraint', async () => {
    prismaMock.field.findMany.mockResolvedValue([])
    prismaMock.field.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7.9.0' }),
    )

    await expect(FieldService.createField(TABLE_ID, input({ type: 'TEXT' }))).rejects.toMatchObject(
      {
        statusCode: 409,
        statusMessage: 'A field with this name already exists',
      },
    )
  })
})

describe('updateField — the write guards', () => {
  it('404s for a field that is not on this table', async () => {
    prismaMock.field.findFirst.mockResolvedValue(null)

    await expect(FieldService.updateField(TABLE_ID, FIELD_ID, relation())).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Field not found',
    })
    expect(prismaMock.field.update).not.toHaveBeenCalled()
  })

  it('refuses a type change, which every stored value was written under', async () => {
    prismaMock.field.findFirst.mockResolvedValue(storedField({ type: 'TEXT' }))

    await expect(FieldService.updateField(TABLE_ID, FIELD_ID, relation())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Field type cannot be changed',
    })
  })

  it('refuses retargeting a relation, which would orphan every id already stored', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ options: { targetTableId: 'tbl_people', labelFieldKey: 'full_name' } }),
    )

    await expect(
      FieldService.updateField(TABLE_ID, FIELD_ID, relation({ targetTableId: 'tbl_other' })),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Relation target cannot be changed',
    })
  })

  it('allows the label field to move, since it is display only', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ options: { targetTableId: 'tbl_people', labelFieldKey: 'full_name' } }),
    )
    prismaMock.field.update.mockResolvedValue(stored(textField('owner')))

    await expect(
      FieldService.updateField(TABLE_ID, FIELD_ID, relation({ labelFieldKey: 'email' })),
    ).resolves.toBeDefined()
  })

  it('refuses narrowing a multi-value field, which would discard every value past the first', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({
        options: { targetTableId: 'tbl_people', labelFieldKey: 'full_name', multiple: true },
      }),
    )

    await expect(
      FieldService.updateField(TABLE_ID, FIELD_ID, relation({ multiple: false })),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'A multi-value field cannot be changed back to a single value',
    })
  })

  it('never reaches the database when a guard fires', async () => {
    prismaMock.field.findFirst.mockResolvedValue(storedField({ type: 'TEXT' }))

    await expect(FieldService.updateField(TABLE_ID, FIELD_ID, relation())).rejects.toBeDefined()

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.field.update).not.toHaveBeenCalled()
  })
})

describe('updateField — a required field every creating role can fill', () => {
  const text = (required: boolean) => input({ type: 'TEXT', name: 'Company', required })

  beforeEach(() => {
    prismaMock.field.findFirst.mockResolvedValue(storedField({ type: 'TEXT', key: 'company' }))
    prismaMock.field.update.mockResolvedValue(stored(textField('company')))
  })

  it('refuses with a 409 naming the role that adds records but cannot fill it', async () => {
    prismaMock.roleFieldAccess.findFirst.mockResolvedValue({ role: { name: 'Clerk' } })

    await expect(FieldService.updateField(TABLE_ID, FIELD_ID, text(true))).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Role "Clerk" can add records but cannot fill "Company"',
    })
    expect(prismaMock.field.update).not.toHaveBeenCalled()
  })

  it('asks about roles whose row for the table lets them create, and not managers', async () => {
    prismaMock.roleFieldAccess.findFirst.mockResolvedValue(null)

    await FieldService.updateField(TABLE_ID, FIELD_ID, text(true))

    expect(prismaMock.roleFieldAccess.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fieldId: FIELD_ID,
          role: {
            NOT: { permissions: { has: 'TABLES_MANAGE' } },
            tableAccess: { some: { tableId: TABLE_ID, canCreate: true } },
          },
        },
      }),
    )
    expect(prismaMock.field.update).toHaveBeenCalled()
  })

  it('asks nothing for a field left optional', async () => {
    await FieldService.updateField(TABLE_ID, FIELD_ID, text(false))

    expect(prismaMock.roleFieldAccess.findFirst).not.toHaveBeenCalled()
  })
})

describe('updateField — widening', () => {
  it('rewrites the stored rows in the same transaction as the metadata', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ key: 'stage', type: 'SELECT', options: { choices: [], multiple: false } }),
    )
    prismaMock.field.update.mockResolvedValue(stored(textField('stage')))

    await FieldService.updateField(TABLE_ID, FIELD_ID, select({ multiple: true }))

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.field.update).toHaveBeenCalled()
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('leaves the rows alone when cardinality does not move', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ key: 'stage', type: 'SELECT', options: { choices: [], multiple: false } }),
    )
    prismaMock.field.update.mockResolvedValue(stored(textField('stage')))

    await FieldService.updateField(TABLE_ID, FIELD_ID, select({ multiple: false }))

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()
  })

  it('leaves them alone for a field that was already multi-value', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ key: 'stage', type: 'SELECT', options: { choices: [], multiple: true } }),
    )
    prismaMock.field.update.mockResolvedValue(stored(textField('stage')))

    await FieldService.updateField(TABLE_ID, FIELD_ID, select({ multiple: true }))

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()
  })

  it('maps a rename onto a taken name as a 409, same as creating one', async () => {
    prismaMock.field.findFirst.mockResolvedValue(storedField({ type: 'TEXT' }))
    prismaMock.field.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '7.9.0' }),
    )

    await expect(
      FieldService.updateField(TABLE_ID, FIELD_ID, input({ type: 'TEXT', name: 'Taken' })),
    ).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'A field with this name already exists',
    })
  })

  it('keeps the key out of the update — it is immutable once records reference it', async () => {
    prismaMock.field.findFirst.mockResolvedValue(storedField({ type: 'TEXT' }))
    prismaMock.field.update.mockResolvedValue(stored(textField('owner')))

    await FieldService.updateField(TABLE_ID, FIELD_ID, input({ type: 'TEXT', name: 'Renamed' }))

    const [call] = prismaMock.field.update.mock.calls
    expect(call?.[0].data).not.toHaveProperty('key')
    expect(call?.[0].data).toMatchObject({ name: 'Renamed' })
  })
})

describe('createField — a key lost to a racing create', () => {
  const keyTaken = () =>
    new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '7.9.0',
      meta: { driverAdapterError: { cause: { constraint: { fields: ['"tableId"', 'key'] } } } },
    })

  it('reads again and takes the next free key instead of answering 409', async () => {
    prismaMock.field.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ key: 'price', type: 'TEXT', order: 0 }])
    prismaMock.field.create
      .mockRejectedValueOnce(keyTaken())
      .mockResolvedValueOnce(stored(textField('price_2')))

    await expect(
      FieldService.createField(TABLE_ID, input({ type: 'TEXT', name: 'Price' })),
    ).resolves.toMatchObject({ key: 'price_2' })

    expect(prismaMock.field.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: 'price_2', order: 1 }) }),
    )
  })

  it('gives up after a few attempts and reports the conflict', async () => {
    prismaMock.field.findMany.mockResolvedValue([])
    prismaMock.field.create.mockRejectedValue(keyTaken())

    await expect(
      FieldService.createField(TABLE_ID, input({ type: 'TEXT', name: 'Price' })),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(prismaMock.field.create).toHaveBeenCalledTimes(3)
  })
})

describe('createField — the field cap', () => {
  it('refuses a field past the cap before writing anything', async () => {
    prismaMock.field.findMany.mockResolvedValue(
      Array.from({ length: MAX_TABLE_FIELDS }, (_, order) => ({
        key: `f${order}`,
        type: 'TEXT',
        order,
      })),
    )

    await expect(FieldService.createField(TABLE_ID, input({ type: 'TEXT' }))).rejects.toMatchObject(
      {
        statusCode: 409,
        statusMessage: `A table can have at most ${MAX_TABLE_FIELDS} fields`,
      },
    )
    expect(prismaMock.field.create).not.toHaveBeenCalled()
  })
})

describe('updateField — given the version the caller read', () => {
  it('puts the version in the update’s where, so the check and the write are one statement', async () => {
    prismaMock.field.findFirst.mockResolvedValue(storedField({ type: 'TEXT' }))
    prismaMock.field.update.mockResolvedValue(stored(textField('owner')))

    await FieldService.updateField(TABLE_ID, FIELD_ID, input({ type: 'TEXT' }), READ_AT)

    expect(prismaMock.field.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FIELD_ID, tableId: TABLE_ID, updatedAt: READ_AT } }),
    )
  })

  it('answers 412 when the field is still there under a newer version', async () => {
    prismaMock.field.findFirst
      .mockResolvedValueOnce(storedField({ type: 'TEXT' }))
      .mockResolvedValueOnce({ id: FIELD_ID })
    prismaMock.field.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(
      FieldService.updateField(TABLE_ID, FIELD_ID, input({ type: 'TEXT' }), READ_AT),
    ).rejects.toMatchObject({ statusCode: 412 })
  })
})

describe('FieldService.deleteField', () => {
  const WORKSPACE_ID = 'ws_acme'

  const finds = (field: { key: string } | null, labelReference: unknown = null) =>
    prismaMock.field.findFirst.mockResolvedValueOnce(field).mockResolvedValueOnce(labelReference)

  it('scopes the delete to the table, so a field id alone is not enough', async () => {
    finds({ key: 'owner' })
    prismaMock.field.delete.mockResolvedValue(textField('owner'))

    await FieldService.deleteField(WORKSPACE_ID, TABLE_ID, FIELD_ID)

    expect(prismaMock.field.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: FIELD_ID, tableId: TABLE_ID },
      select: { key: true },
    })
    expect(prismaMock.field.delete).toHaveBeenCalledWith({
      where: { id: FIELD_ID, tableId: TABLE_ID },
    })
  })

  it('clears the key from the table’s records in the same transaction as the delete', async () => {
    finds({ key: 'owner' })
    prismaMock.field.delete.mockResolvedValue(textField('owner'))

    await FieldService.deleteField(WORKSPACE_ID, TABLE_ID, FIELD_ID)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    const [[template, ...values]] = prismaMock.$executeRaw.mock.calls as [[string[], ...unknown[]]]
    expect(template.join('?')).toContain('SET data = data - ?::text')
    expect(values).toEqual(['owner', TABLE_ID, 'owner'])
  })

  it('refuses while a relation shows the field as its label, before deleting anything', async () => {
    finds({ key: 'full_name' }, { name: 'Owner', table: { name: 'Deals' } })

    await expect(FieldService.deleteField(WORKSPACE_ID, TABLE_ID, FIELD_ID)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: '"Owner" in "Deals" shows this field as its label',
    })

    expect(prismaMock.field.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          table: { workspaceId: WORKSPACE_ID },
          options: { path: ['targetTableId'], equals: TABLE_ID },
          AND: [{ options: { path: ['labelFieldKey'], equals: 'full_name' } }],
        }),
      }),
    )
    expect(prismaMock.field.delete).not.toHaveBeenCalled()
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()
  })

  it('404s on a field outside the table, before touching anything else', async () => {
    finds(null)

    await expect(FieldService.deleteField(WORKSPACE_ID, TABLE_ID, FIELD_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Field not found',
    })
    expect(prismaMock.field.findFirst).toHaveBeenCalledTimes(1)
    expect(prismaMock.field.delete).not.toHaveBeenCalled()
  })

  it('maps a row deleted in between onto a 404', async () => {
    finds({ key: 'owner' })
    prismaMock.field.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(FieldService.deleteField(WORKSPACE_ID, TABLE_ID, FIELD_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Field not found',
    })
  })
})

describe('one field’s index work runs one job at a time', () => {
  it('starts the second sync only after the first has finished', async () => {
    let releaseFirst: (rows: unknown[]) => void = () => {}
    prismaMock.$queryRaw
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValue([])
    prismaMock.field.findFirst.mockResolvedValue(storedField({ type: 'TEXT' }))
    prismaMock.field.update.mockResolvedValue(stored(textField('owner', { indexed: true })))

    await FieldService.updateField(TABLE_ID, FIELD_ID, input({ type: 'TEXT', indexed: true }))
    await FieldService.updateField(TABLE_ID, FIELD_ID, input({ type: 'TEXT', indexed: false }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    // The catalogue read is each sync's first step: the second has not begun
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)

    releaseFirst([])
    await vi.waitFor(() => expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2))
  })
})

describe('a failed index build never reaches the caller', () => {
  it('resolves the write, and does not leave the rejection unhandled', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    prismaMock.field.findMany.mockResolvedValue([])
    prismaMock.$queryRaw.mockRejectedValue(new Error('no such relation'))
    prismaMock.field.create.mockResolvedValue(stored(textField('owner', { indexed: true })))

    await expect(
      FieldService.createField(TABLE_ID, input({ type: 'TEXT' })),
    ).resolves.toMatchObject({
      key: 'owner',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', unhandled)

    expect(prismaMock.$queryRaw).toHaveBeenCalled()
    expect(unhandled).not.toHaveBeenCalled()
  })
})
