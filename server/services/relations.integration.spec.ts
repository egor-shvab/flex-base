import { beforeEach, describe, expect, it } from 'vitest'
import {
  assertRelationTargets,
  listRelationOptions,
  resolveRelationLabels,
} from '#server/services/relations'
import { createRecord as createRecordService } from '#server/services/records'
import { RELATION_OPTIONS_LIMIT } from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import type { IRecord, TRecordData } from '#shared/types/record'
import { createField, createRecord, createTable, createUser } from '~~/test/integration/seed'

let userId: string
let peopleId: string
let owner: IField

/** The shape `resolveRelationLabels` reads; only these two fields matter to it. */
const asRecord = (data: TRecordData): IRecord => ({
  id: 'rec',
  number: 1,
  data,
  createdAt: '',
  updatedAt: '',
})

beforeEach(async () => {
  userId = (await createUser()).id

  const people = await createTable(userId, 'People')
  peopleId = people.id
  await createField(peopleId, { key: 'full_name', type: 'TEXT' })

  const deals = await createTable(userId, 'Deals')
  owner = await createField(deals.id, {
    key: 'owner',
    name: 'Owner',
    type: 'RELATION',
    options: { targetTableId: peopleId, labelFieldKey: 'full_name' },
  })
})

describe('resolving labels', () => {
  it('reads the label field of the linked record', async () => {
    const ada = await createRecord(peopleId, { full_name: 'Ada' })

    const labels = await resolveRelationLabels([owner], [asRecord({ owner: ada.id })])

    expect(labels[owner.id]).toEqual({ [ada.id]: 'Ada' })
  })

  it('falls back to the record number when the label field is blank', async () => {
    const blank = await createRecord(peopleId, { full_name: '' })

    const labels = await resolveRelationLabels([owner], [asRecord({ owner: blank.id })])

    expect(labels[owner.id]?.[blank.id]).toBe(`#${blank.number}`)
  })

  /** A deleted target degrades to a placeholder in the cell rather than breaking the list. */
  it('leaves an id that no longer resolves absent', async () => {
    const labels = await resolveRelationLabels([owner], [asRecord({ owner: 'rec_gone' })])

    expect(labels[owner.id]).toEqual({})
  })

  it('will not resolve an id through the wrong table', async () => {
    const elsewhere = await createTable(userId, 'Elsewhere')
    const stranger = await createRecord(elsewhere.id, { full_name: 'Not Ada' })

    const labels = await resolveRelationLabels([owner], [asRecord({ owner: stranger.id })])

    expect(labels[owner.id]).toEqual({})
  })

  it('resolves every id of a widened field', async () => {
    const ada = await createRecord(peopleId, { full_name: 'Ada' })
    const grace = await createRecord(peopleId, { full_name: 'Grace' })
    const multi = { ...owner, options: { ...owner.options, multiple: true } }

    const labels = await resolveRelationLabels([multi], [asRecord({ owner: [ada.id, grace.id] })])

    expect(labels[owner.id]).toEqual({ [ada.id]: 'Ada', [grace.id]: 'Grace' })
  })
})

describe('checking a write’s targets', () => {
  it('accepts an id the target table holds', async () => {
    const ada = await createRecord(peopleId, { full_name: 'Ada' })

    await expect(assertRelationTargets([owner], { owner: ada.id })).resolves.toBeUndefined()
  })

  it('rejects an id from another table, which is what a crafted payload looks like', async () => {
    const elsewhere = await createTable(userId, 'Elsewhere')
    const stranger = await createRecord(elsewhere.id, {})

    await expect(assertRelationTargets([owner], { owner: stranger.id })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Owner: the linked record no longer exists',
    })
  })

  it('rejects a record deleted between the picker and the save', async () => {
    const ada = await createRecord(peopleId, { full_name: 'Ada' })
    const dealsFields = [owner]

    await expect(
      createRecordService(owner.id, dealsFields, { owner: `${ada.id}x` }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('the options a picker offers', () => {
  it('lists the target table’s records, labelled', async () => {
    await createRecord(peopleId, { full_name: 'Grace' })
    await createRecord(peopleId, { full_name: 'Ada' })

    const options = await listRelationOptions(owner)

    expect(options.map((option) => option.label)).toEqual(['Ada', 'Grace'])
  })

  it('orders by the label the user reads, not by the id stored', async () => {
    await createRecord(peopleId, { full_name: 'Zoe' })
    await createRecord(peopleId, { full_name: 'Ada' })
    await createRecord(peopleId, { full_name: 'Mo' })

    const options = await listRelationOptions(owner)

    expect(options.map((option) => option.label)).toEqual(['Ada', 'Mo', 'Zoe'])
  })

  it('narrows on a search term', async () => {
    await createRecord(peopleId, { full_name: 'Ada Lovelace' })
    await createRecord(peopleId, { full_name: 'Grace Hopper' })

    const options = await listRelationOptions(owner, 'hopp')

    expect(options.map((option) => option.label)).toEqual(['Grace Hopper'])
  })

  it('matches the #number a blank label falls back to', async () => {
    const blank = await createRecord(peopleId, { full_name: '' })

    const options = await listRelationOptions(owner, `#${blank.number}`)

    expect(options.map((option) => option.id)).toEqual([blank.id])
  })

  it('treats a wildcard the user typed as a literal', async () => {
    await createRecord(peopleId, { full_name: 'Ada' })

    await expect(listRelationOptions(owner, '%')).resolves.toEqual([])
  })

  it('offers nothing for a field with no target', async () => {
    const untargeted = { ...owner, options: {} }

    await expect(listRelationOptions(untargeted)).resolves.toEqual([])
  })

  it('never offers a record of another table', async () => {
    const elsewhere = await createTable(userId, 'Elsewhere')
    await createRecord(elsewhere.id, { full_name: 'Stranger' })
    await createRecord(peopleId, { full_name: 'Ada' })

    const options = await listRelationOptions(owner)

    expect(options.map((option) => option.label)).toEqual(['Ada'])
  })

  it(`caps the list at ${RELATION_OPTIONS_LIMIT} matches`, async () => {
    // One over the cap, so the boundary is exercised rather than approached
    for (let index = 0; index <= RELATION_OPTIONS_LIMIT; index += 1) {
      await createRecord(peopleId, { full_name: `Person ${String(index).padStart(4, '0')}` })
    }

    const options = await listRelationOptions(owner)

    expect(options).toHaveLength(RELATION_OPTIONS_LIMIT)
  })
})
