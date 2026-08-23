import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RelationService } from '#server/services/relations'
import { RELATION_OPTIONS_LIMIT } from '#shared/constants/record'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { asMultiple, record, relationField, textField } from '~~/test/fixtures'

vi.mock('#server/db/prisma', async () => ({
  prisma: (await import('~~/test/prisma-mock')).prismaMock,
}))

const owner = relationField()
const reviewer = relationField({}, { key: 'reviewer', id: 'fld_reviewer' })

function isSqlFragment(value: unknown): value is { values: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { values?: unknown }).values)
  )
}

/**
 * Every value a tagged-template call binds, one level into any nested `Prisma.Sql` — a
 * fragment composed into the template carries its own parameters rather than flattening
 * into the outer call's.
 */
function boundValues(args: unknown[]): unknown[] {
  return args.slice(1).flatMap((arg) => (isSqlFragment(arg) ? arg.values : [arg]))
}

/** A row as the target lookup returns it — enough to label the record it stands for. */
function targetRow(id: string, number: number, fullName?: string) {
  return { id, number, data: fullName === undefined ? {} : { full_name: fullName } }
}

beforeEach(resetPrismaMock)

/**
 * The normalisation seam. Everything downstream — the label resolver, the write-time check —
 * works in sets and batches, so this is the single place that has to cope with what a JSONB
 * column can actually hold, including values written before a field was widened.
 */
describe('RelationService.collectRelationTargets', () => {
  it('collects the ids a single-value relation stores', () => {
    const targets = RelationService.collectRelationTargets(
      [owner],
      [{ owner: 'rec_1' }, { owner: 'rec_2' }],
    )

    expect(targets).toHaveLength(1)
    expect(targets[0]?.targetTableId).toBe('tbl_people')
    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1', 'rec_2'])
  })

  it('reads a list from a widened field', () => {
    const targets = RelationService.collectRelationTargets(
      [asMultiple(owner)],
      [{ owner: ['rec_1', 'rec_2'] }],
    )

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1', 'rec_2'])
  })

  it('reads a bare string left over from before the field was widened', () => {
    // The widening migration is not a precondition for reading — a row it has not reached yet
    // still holds a scalar, and that link must keep resolving
    const targets = RelationService.collectRelationTargets(
      [asMultiple(owner)],
      [{ owner: 'rec_1' }],
    )

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1'])
  })

  it('deduplicates an id shared by several rows', () => {
    const targets = RelationService.collectRelationTargets(
      [owner],
      [{ owner: 'rec_1' }, { owner: 'rec_1' }, { owner: 'rec_2' }],
    )

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1', 'rec_2'])
  })

  it('drops blanks, nulls and anything that is not a string', () => {
    const targets = RelationService.collectRelationTargets(
      [asMultiple(owner)],
      [{ owner: ['rec_1', '', null, 42, undefined] as never }],
    )

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1'])
  })

  it('skips a relation field that no row actually links through', () => {
    expect(RelationService.collectRelationTargets([owner], [{ owner: '' }, {}])).toEqual([])
  })

  it('ignores a field that is not a relation, and one with no target', () => {
    const untargeted = relationField({ targetTableId: undefined })

    expect(
      RelationService.collectRelationTargets([textField('company')], [{ company: 'acme' }]),
    ).toEqual([])
    expect(RelationService.collectRelationTargets([untargeted], [{ owner: 'rec_1' }])).toEqual([])
  })

  it('keeps two relation fields apart even when they point at one table', () => {
    const targets = RelationService.collectRelationTargets(
      [owner, reviewer],
      [{ owner: 'rec_1', reviewer: 'rec_2' }],
    )

    expect(targets).toHaveLength(2)
    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1'])
    expect([...(targets[1]?.ids ?? [])]).toEqual(['rec_2'])
  })
})

describe('RelationService.resolveLinkedRecords', () => {
  it('asks nothing of the database when there is nothing to resolve', async () => {
    await expect(RelationService.resolveLinkedRecords([owner], [record()])).resolves.toEqual({})
    expect(prismaMock.record.findMany).not.toHaveBeenCalled()
  })

  it('resolves each id to its number and label, keyed by the field that points at it', async () => {
    prismaMock.record.findMany.mockResolvedValue([targetRow('rec_1', 1, 'Ada')])

    const refs = await RelationService.resolveLinkedRecords(
      [owner],
      [record({ data: { owner: 'rec_1' } })],
    )

    expect(refs).toEqual({ fld_owner: { rec_1: { number: 1, label: 'Ada' } } })
  })

  /** The number carries the whole reference when the label field says nothing. */
  it('resolves a blank label field to a null label, never to the number', async () => {
    prismaMock.record.findMany.mockResolvedValue([targetRow('rec_1', 7)])

    const refs = await RelationService.resolveLinkedRecords(
      [owner],
      [record({ data: { owner: 'rec_1' } })],
    )

    expect(refs.fld_owner?.rec_1).toEqual({ number: 7, label: null })
  })

  it('resolves a target whose data column is null, rather than failing on it', async () => {
    prismaMock.record.findMany.mockResolvedValue([{ id: 'rec_1', number: 4, data: null }])

    const refs = await RelationService.resolveLinkedRecords(
      [owner],
      [record({ data: { owner: 'rec_1' } })],
    )

    expect(refs.fld_owner?.rec_1).toEqual({ number: 4, label: null })
  })

  it('leaves an unresolvable id absent rather than inventing a placeholder', async () => {
    // A deleted target degrades in the cell, which is where the copy for it lives
    prismaMock.record.findMany.mockResolvedValue([])

    const refs = await RelationService.resolveLinkedRecords(
      [owner],
      [record({ data: { owner: 'rec_gone' } })],
    )

    expect(refs).toEqual({ fld_owner: {} })
  })

  it('issues one query per target table, never one per row', async () => {
    prismaMock.record.findMany.mockResolvedValue([
      targetRow('rec_1', 1, 'Ada'),
      targetRow('rec_2', 2, 'Grace'),
    ])

    await RelationService.resolveLinkedRecords(
      [owner, reviewer],
      [
        record({ id: 'a', data: { owner: 'rec_1', reviewer: 'rec_2' } }),
        record({ id: 'b', data: { owner: 'rec_2', reviewer: 'rec_1' } }),
      ],
    )

    expect(prismaMock.record.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.record.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tableId: 'tbl_people', id: { in: ['rec_1', 'rec_2'] } },
      }),
    )
  })

  it('keeps two target tables in separate lookups, so a foreign id cannot pass as found', async () => {
    const elsewhere = relationField(
      { targetTableId: 'tbl_orgs' },
      { key: 'org', id: 'fld_org', name: 'Org' },
    )
    prismaMock.record.findMany.mockResolvedValue([])

    await RelationService.resolveLinkedRecords(
      [owner, elsewhere],
      [record({ data: { owner: 'r1', org: 'r2' } })],
    )

    expect(prismaMock.record.findMany).toHaveBeenCalledTimes(2)
  })

  it('resolves every id of a widened field', async () => {
    prismaMock.record.findMany.mockResolvedValue([
      targetRow('rec_1', 1, 'Ada'),
      targetRow('rec_2', 2, 'Grace'),
    ])

    const refs = await RelationService.resolveLinkedRecords(
      [asMultiple(owner)],
      [record({ data: { owner: ['rec_1', 'rec_2'] } })],
    )

    expect(refs.fld_owner).toEqual({
      rec_1: { number: 1, label: 'Ada' },
      rec_2: { number: 2, label: 'Grace' },
    })
  })
})

describe('RelationService.assertRelationTargets', () => {
  it('passes silently when there is nothing linked', async () => {
    await expect(RelationService.assertRelationTargets([owner], {})).resolves.toBeUndefined()
    expect(prismaMock.record.findMany).not.toHaveBeenCalled()
  })

  it('accepts an id the target table really holds', async () => {
    prismaMock.record.findMany.mockResolvedValue([targetRow('rec_1', 1, 'Ada')])

    await expect(
      RelationService.assertRelationTargets([owner], { owner: 'rec_1' }),
    ).resolves.toBeUndefined()
  })

  it('rejects a crafted id, naming the field it came in on', async () => {
    prismaMock.record.findMany.mockResolvedValue([])

    await expect(
      RelationService.assertRelationTargets([owner], { owner: 'rec_forged' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'owner: the linked record no longer exists',
    })
  })

  it('rejects when only some of a widened field’s ids resolve', async () => {
    prismaMock.record.findMany.mockResolvedValue([targetRow('rec_1', 1, 'Ada')])

    await expect(
      RelationService.assertRelationTargets([asMultiple(owner)], { owner: ['rec_1', 'rec_gone'] }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('RelationService.listRelationOptions', () => {
  it('has nothing to offer for a field with no target', async () => {
    await expect(
      RelationService.listRelationOptions(relationField({ targetTableId: undefined })),
    ).resolves.toEqual([])
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  /** The picker states a number beside every candidate, so it travels with each of them. */
  it('offers each candidate as its id, its number and its label', async () => {
    prismaMock.$queryRaw.mockResolvedValue([targetRow('rec_1', 1, 'Ada'), targetRow('rec_2', 2)])

    await expect(RelationService.listRelationOptions(owner)).resolves.toEqual([
      { id: 'rec_1', number: 1, label: 'Ada' },
      { id: 'rec_2', number: 2, label: null },
    ])
  })

  it('binds the target table and the cap as parameters', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner)

    const values = prismaMock.$queryRaw.mock.calls[0]?.slice(1)
    expect(values).toContain('tbl_people')
    expect(values).toContain(RELATION_OPTIONS_LIMIT)
  })

  it('pushes a search term into the query as a bound pattern', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner, 'ada')

    // The term arrives nested in the search fragment, not as a top-level template value —
    // what the fragment itself matches on is pinned in `record-query.spec.ts`
    expect(boundValues(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain('%ada%')
  })

  it('adds no search fragment at all when nothing was typed', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner)

    expect(boundValues(prismaMock.$queryRaw.mock.calls[0] ?? [])).not.toContain('%%')
  })
})
