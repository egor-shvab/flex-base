import { beforeEach, describe, expect, it } from 'vitest'
import fieldsGet from '#server/api/tables/[tableAddress]/fields/index.get'
import fieldPatch from '#server/api/tables/[tableAddress]/fields/[fieldId].patch'
import type { IAuthUser } from '#shared/types/auth'
import { testEvent } from '~~/test/integration/event'
import { createField, createTable, createUser } from '~~/test/integration/seed'

/**
 * The field endpoints at the **handler** layer. What `updateField` refuses, and what widening
 * does to the rows, belong to `server/services/fields.integration.spec.ts`.
 *
 * Only true at this layer: the route's two params reach the right row, and `requireFieldTarget`
 * runs on the way in. Everything underneath takes a `fieldId` and cannot tell a mis-wired one
 * from a correct one.
 */
let ada: IAuthUser
let tableId: string
let peopleId: string

const fields = async () =>
  (await fieldsGet(testEvent({ user: ada, params: { tableAddress: tableId } }))).fields

const patch = (fieldId: string, body: unknown) =>
  fieldPatch(
    testEvent({ user: ada, params: { tableAddress: tableId, fieldId }, method: 'PATCH', body }),
  )

beforeEach(async () => {
  ada = await createUser()

  const people = await createTable(ada.id, 'People')
  peopleId = people.id
  await createField(peopleId, { key: 'full_name', type: 'TEXT', name: 'Full name' })
  await createField(peopleId, { key: 'nickname', type: 'TEXT', name: 'Nickname', order: 1 })

  const table = await createTable(ada.id, 'Deals')
  tableId = table.id
  await createField(tableId, { key: 'company', type: 'TEXT', name: 'Company', order: 0 })
  await createField(tableId, { key: 'notes', type: 'TEXT', name: 'Notes', order: 1 })
})

describe('updating a field through the endpoint', () => {
  /**
   * The sibling assertion is the point. "Company became Client" also passes when the handler
   * reaches for the first field of the table regardless of the id it was given; "and Notes did
   * not" is what fails on a mis-wired param.
   */
  it('updates the field the route names, and leaves its siblings alone', async () => {
    const [company, notes] = await fields()

    const { field } = await patch(company!.id, { name: 'Client', type: 'TEXT' })

    expect(field).toMatchObject({ id: company!.id, name: 'Client' })

    const after = await fields()
    expect(after.map((entry) => entry.name)).toEqual(['Client', 'Notes'])
    expect(after[1]).toMatchObject({ id: notes!.id, name: 'Notes' })
  })

  /** The key is immutable, so a rename moves the label and nothing a record is stored under. */
  it('keeps the key a rename cannot touch', async () => {
    const [company] = await fields()

    const { field } = await patch(company!.id, { name: 'Client', type: 'TEXT' })

    expect(field.key).toBe('company')
  })

  it('400s on a malformed body, changing nothing', async () => {
    const [company] = await fields()

    await expect(patch(company!.id, { name: '', type: 'TEXT' })).rejects.toMatchObject({
      statusCode: 400,
    })

    expect((await fields()).map((entry) => entry.name)).toEqual(['Company', 'Notes'])
  })

  it('404s on a field id belonging to another table', async () => {
    const other = await createTable(ada.id, 'Other')
    const stranger = await createField(other.id, { key: 'company', type: 'TEXT' })

    await expect(patch(stranger.id, { name: 'Client', type: 'TEXT' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  /**
   * A relation's target is immutable but **its label field is not** (`architecture.md` §6), so
   * `requireFieldTarget` is genuinely reachable here — the one part of a relation's options an
   * update can still move. The ownership spec proves the same check for *create*.
   */
  describe('a relation’s label field, which stays editable', () => {
    let ownerId: string

    const relation = (labelFieldKey: string) => ({
      name: 'Owner',
      type: 'RELATION' as const,
      targetTableId: peopleId,
      labelFieldKey,
    })

    beforeEach(async () => {
      const owner = await createField(tableId, {
        key: 'owner',
        type: 'RELATION',
        name: 'Owner',
        order: 2,
        options: { targetTableId: peopleId, labelFieldKey: 'full_name' },
      })
      ownerId = owner.id
    })

    it('moves to another field the target table has', async () => {
      const { field } = await patch(ownerId, relation('nickname'))

      expect(field.options).toMatchObject({ targetTableId: peopleId, labelFieldKey: 'nickname' })
    })

    it('400s on a label field the target table does not have', async () => {
      await expect(patch(ownerId, relation('no_such_field'))).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Unknown field to show for the link',
      })

      const unchanged = (await fields()).find((entry) => entry.id === ownerId)
      expect(unchanged?.options).toMatchObject({ labelFieldKey: 'full_name' })
    })
  })
})
