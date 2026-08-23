import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import { Prisma } from '#server/generated/prisma/client'
import { FieldService } from '#server/services/fields'
import { fieldInputSchema, type TFieldInput } from '#shared/validation/field'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { textField } from '~~/test/fixtures'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const TABLE_ID = 'tbl_deals'
const FIELD_ID = 'fld_owner'

/**
 * The schema's *input* type, not its output: a spec writes a choice without a colour and lets
 * the default land, which is the wire shape a client actually sends.
 */
type TFieldDraft = z.input<typeof fieldInputSchema>

function input(overrides: Partial<TFieldDraft> & Pick<TFieldDraft, 'type'>): TFieldInput {
  return fieldInputSchema.parse({ name: 'Owner', ...overrides })
}

const relation = (overrides: Partial<TFieldDraft> = {}) =>
  input({ type: 'RELATION', targetTableId: 'tbl_people', labelFieldKey: 'full_name', ...overrides })

const select = (overrides: Partial<TFieldDraft> = {}) =>
  input({ type: 'SELECT', choices: [{ value: 'Won' }], ...overrides })

/** The row `updateField` reads before it decides anything. */
function storedField(overrides: Partial<{ key: string; type: string; options: unknown }> = {}) {
  return { key: 'owner', type: 'RELATION', options: null, ...overrides }
}

beforeEach(resetPrismaMock)

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

describe('FieldService.listFields', () => {
  it('reads a table’s fields in stored order and narrows their options', async () => {
    prismaMock.field.findMany.mockResolvedValue([{ ...textField('company'), options: null }])

    const fields = await FieldService.listFields(TABLE_ID)

    expect(prismaMock.field.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tableId: TABLE_ID }, orderBy: { order: 'asc' } }),
    )
    expect(fields[0]).toMatchObject({ key: 'company', options: null })
  })
})

describe('createField — order allocation', () => {
  it('starts an empty table at zero', async () => {
    prismaMock.field.findMany.mockResolvedValue([])
    prismaMock.field.create.mockResolvedValue(textField('owner'))

    await FieldService.createField(TABLE_ID, input({ type: 'TEXT' }))

    expect(prismaMock.field.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 0 }) }),
    )
  })

  it('appends past the highest existing order, not past the count', async () => {
    // A deleted field leaves a hole, so counting rows would reuse an order already taken
    prismaMock.field.findMany.mockResolvedValue([
      { key: 'a', type: 'TEXT', order: 0 },
      { key: 'b', type: 'TEXT', order: 7 },
    ])
    prismaMock.field.create.mockResolvedValue(textField('owner'))

    await FieldService.createField(TABLE_ID, input({ type: 'TEXT' }))

    expect(prismaMock.field.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 8 }) }),
    )
  })

  it('derives the key from the name, against the keys already taken', async () => {
    prismaMock.field.findMany.mockResolvedValue([{ key: 'owner', type: 'TEXT', order: 0 }])
    prismaMock.field.create.mockResolvedValue(textField('owner_2'))

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

/**
 * These three guards are the whole reason `updateField` is not a straight `update`: each one
 * protects data already stored against a change the metadata alone would happily accept.
 */
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
    prismaMock.field.update.mockResolvedValue(textField('owner'))

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

describe('updateField — widening', () => {
  it('rewrites the stored rows in the same transaction as the metadata', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ key: 'stage', type: 'SELECT', options: { choices: [], multiple: false } }),
    )
    prismaMock.field.update.mockResolvedValue(textField('stage'))

    await FieldService.updateField(TABLE_ID, FIELD_ID, select({ multiple: true }))

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    // The stub hands the callback itself as `tx`, so both halves land on the same spies
    expect(prismaMock.field.update).toHaveBeenCalled()
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('leaves the rows alone when cardinality does not move', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ key: 'stage', type: 'SELECT', options: { choices: [], multiple: false } }),
    )
    prismaMock.field.update.mockResolvedValue(textField('stage'))

    await FieldService.updateField(TABLE_ID, FIELD_ID, select({ multiple: false }))

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()
  })

  it('leaves them alone for a field that was already multi-value', async () => {
    prismaMock.field.findFirst.mockResolvedValue(
      storedField({ key: 'stage', type: 'SELECT', options: { choices: [], multiple: true } }),
    )
    prismaMock.field.update.mockResolvedValue(textField('stage'))

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
    prismaMock.field.update.mockResolvedValue(textField('owner'))

    await FieldService.updateField(TABLE_ID, FIELD_ID, input({ type: 'TEXT', name: 'Renamed' }))

    const [call] = prismaMock.field.update.mock.calls
    expect(call?.[0].data).not.toHaveProperty('key')
    expect(call?.[0].data).toMatchObject({ name: 'Renamed' })
  })
})

describe('FieldService.deleteField', () => {
  it('scopes the delete to the table, so a field id alone is not enough', async () => {
    prismaMock.field.delete.mockResolvedValue(textField('owner'))

    await FieldService.deleteField(TABLE_ID, FIELD_ID)

    expect(prismaMock.field.delete).toHaveBeenCalledWith({
      where: { id: FIELD_ID, tableId: TABLE_ID },
    })
  })

  it('maps a missing row onto a 404', async () => {
    prismaMock.field.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '7.9.0' }),
    )

    await expect(FieldService.deleteField(TABLE_ID, FIELD_ID)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Field not found',
    })
  })
})
