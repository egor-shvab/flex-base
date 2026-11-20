import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { RelationService } from '#server/services/relations'
import { RELATION_OPTIONS_LIMIT } from '#shared/constants/record'
import { prismaMock, resetPrismaMock } from '~~/test/prisma-mock'
import { buildRecordActor, FULL_RECORD_ACTOR } from '~~/test/membership'
import { asMultiple, record, relationField, textField } from '~~/test/fixtures'

const REACH = FULL_RECORD_ACTOR

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

function boundValues(args: unknown[]): unknown[] {
  return args.slice(1).flatMap((arg) => (isSqlFragment(arg) ? arg.values : [arg]))
}

/** A target row as the label query returns it: the label field's value, never the whole data. */
function labelRow(id: string, number: number, fullName?: string, createdById = 'usr_1') {
  return { id, number, createdById, label: fullName ?? null }
}

/** A caller who reads only their own records of the people table. */
const OWN_PEOPLE = buildRecordActor('usr_me', undefined, new Map([['tbl_people', 'OWN']]))

function sqlOf(call: unknown[] | undefined): Prisma.Sql {
  const [strings, ...values] = call ?? [[]]
  return new Prisma.Sql(strings as string[], values as Prisma.Sql[])
}

const labelQueries = () => prismaMock.$queryRaw.mock.calls.map(sqlOf)

beforeEach(resetPrismaMock)

describe('RelationService.buildRelationTargets', () => {
  it('collects the ids a single-value relation stores', () => {
    const targets = RelationService.buildRelationTargets(
      [owner],
      [{ owner: 'rec_1' }, { owner: 'rec_2' }],
    )

    expect(targets).toHaveLength(1)
    expect(targets[0]?.targetTableId).toBe('tbl_people')
    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1', 'rec_2'])
  })

  it('reads a list from a widened field', () => {
    const targets = RelationService.buildRelationTargets(
      [asMultiple(owner)],
      [{ owner: ['rec_1', 'rec_2'] }],
    )

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1', 'rec_2'])
  })

  it('reads a bare string left over from before the field was widened', () => {
    const targets = RelationService.buildRelationTargets([asMultiple(owner)], [{ owner: 'rec_1' }])

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1'])
  })

  it('deduplicates an id shared by several rows', () => {
    const targets = RelationService.buildRelationTargets(
      [owner],
      [{ owner: 'rec_1' }, { owner: 'rec_1' }, { owner: 'rec_2' }],
    )

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1', 'rec_2'])
  })

  it('drops blanks, nulls and anything that is not a string', () => {
    const targets = RelationService.buildRelationTargets(
      [asMultiple(owner)],
      [{ owner: ['rec_1', '', null, 42, undefined] as never }],
    )

    expect([...(targets[0]?.ids ?? [])]).toEqual(['rec_1'])
  })

  it('skips a relation field that no row actually links through', () => {
    expect(RelationService.buildRelationTargets([owner], [{ owner: '' }, {}])).toEqual([])
  })

  it('ignores a field that is not a relation, and one with no target', () => {
    const untargeted = relationField({ targetTableId: undefined })

    expect(
      RelationService.buildRelationTargets([textField('company')], [{ company: 'acme' }]),
    ).toEqual([])
    expect(RelationService.buildRelationTargets([untargeted], [{ owner: 'rec_1' }])).toEqual([])
  })

  it('keeps two relation fields apart even when they point at one table', () => {
    const targets = RelationService.buildRelationTargets(
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
    await expect(RelationService.resolveLinkedRecords([owner], [record().data])).resolves.toEqual(
      {},
    )
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('resolves each id to its number and label, keyed by the field that points at it', async () => {
    prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada')])

    const refs = await RelationService.resolveLinkedRecords([owner], [{ owner: 'rec_1' }])

    expect(refs).toEqual({ fld_owner: { rec_1: { number: 1, label: 'Ada' } } })
  })

  it('projects only the label field, never the whole data column', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.resolveLinkedRecords([owner], [{ owner: 'rec_1' }])

    const [query] = labelQueries()
    expect(query?.text).toMatch(
      /SELECT id, "number", "createdById", data -> \$\d+::text AS label FROM "Record"/,
    )
    expect(query?.values).toEqual(expect.arrayContaining(['full_name', 'tbl_people', 'rec_1']))
  })

  it('resolves a blank or missing label to a null label, never to the number', async () => {
    prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 7)])

    const refs = await RelationService.resolveLinkedRecords([owner], [{ owner: 'rec_1' }])

    expect(refs.fld_owner?.rec_1).toEqual({ number: 7, label: null })
  })

  it('labels from a list-valued label field, as the cell shows it', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'rec_1', number: 3, label: ['Ada', 'Grace'] }])

    const refs = await RelationService.resolveLinkedRecords([owner], [{ owner: 'rec_1' }])

    expect(refs.fld_owner?.rec_1).toEqual({ number: 3, label: 'Ada, Grace' })
  })

  it('leaves an unresolvable id absent rather than inventing a placeholder', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    const refs = await RelationService.resolveLinkedRecords([owner], [{ owner: 'rec_gone' }])

    expect(refs).toEqual({ fld_owner: {} })
  })

  it('issues one query per target table and label field, never one per row', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      labelRow('rec_1', 1, 'Ada'),
      labelRow('rec_2', 2, 'Grace'),
    ])

    await RelationService.resolveLinkedRecords(
      [owner, reviewer],
      [
        { owner: 'rec_1', reviewer: 'rec_2' },
        { owner: 'rec_2', reviewer: 'rec_1' },
      ],
    )

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(labelQueries()[0]?.values).toEqual(['full_name', 'tbl_people', 'rec_1', 'rec_2'])
  })

  it('keeps two target tables in separate lookups, so a foreign id cannot pass as found', async () => {
    const elsewhere = relationField(
      { targetTableId: 'tbl_orgs' },
      { key: 'org', id: 'fld_org', name: 'Org' },
    )
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.resolveLinkedRecords([owner, elsewhere], [{ owner: 'r1', org: 'r2' }])

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('looks up one table separately per label field, so each projects its own', async () => {
    const byEmail = relationField(
      { labelFieldKey: 'email' },
      { key: 'contact', id: 'fld_contact', name: 'Contact' },
    )
    prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'value')])

    const refs = await RelationService.resolveLinkedRecords(
      [owner, byEmail],
      [{ owner: 'rec_1', contact: 'rec_1' }],
    )

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
    expect(labelQueries().map((query) => query.values[0])).toEqual(['full_name', 'email'])
    expect(Object.keys(refs)).toEqual(['fld_owner', 'fld_contact'])
  })

  it('resolves the records a filter names, even when no row links to them', async () => {
    prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_9', 9, 'Hedy')])

    const refs = await RelationService.resolveLinkedRecords([owner], [{}, { owner: 'rec_9' }])

    expect(refs.fld_owner?.rec_9).toEqual({ number: 9, label: 'Hedy' })
  })

  it('resolves every id of a widened field', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      labelRow('rec_1', 1, 'Ada'),
      labelRow('rec_2', 2, 'Grace'),
    ])

    const refs = await RelationService.resolveLinkedRecords(
      [asMultiple(owner)],
      [{ owner: ['rec_1', 'rec_2'] }],
    )

    expect(refs.fld_owner).toEqual({
      rec_1: { number: 1, label: 'Ada' },
      rec_2: { number: 2, label: 'Grace' },
    })
  })
})

describe('RelationService.resolveFilterTargets', () => {
  const found = (rows: { id: string; number: number }[]) =>
    prismaMock.record.findMany.mockResolvedValue(rows)

  it('replaces a number with the target record’s id', async () => {
    found([{ id: 'rec_ada', number: 48 }])

    await expect(RelationService.resolveFilterTargets([owner], { owner: '48' })).resolves.toEqual({
      owner: 'rec_ada',
    })
  })

  it('replaces every entry of a list filter', async () => {
    found([
      { id: 'rec_ada', number: 48 },
      { id: 'rec_grace', number: 51 },
    ])

    await expect(
      RelationService.resolveFilterTargets([asMultiple(owner)], { owner: ['48', '51'] }),
    ).resolves.toEqual({ owner: ['rec_ada', 'rec_grace'] })
  })

  it('leaves a value that is not a number exactly as it arrived', async () => {
    await RelationService.resolveFilterTargets([owner], { owner: 'rec_ada' })

    expect(prismaMock.record.findMany).not.toHaveBeenCalled()
    await expect(
      RelationService.resolveFilterTargets([owner], { owner: 'rec_ada' }),
    ).resolves.toEqual({ owner: 'rec_ada' })
  })

  it('keeps an unresolvable number rather than dropping it', async () => {
    found([])

    await expect(RelationService.resolveFilterTargets([owner], { owner: '9999' })).resolves.toEqual(
      { owner: '9999' },
    )
  })

  it('keeps the ones it cannot resolve alongside the ones it can', async () => {
    found([{ id: 'rec_ada', number: 48 }])

    await expect(
      RelationService.resolveFilterTargets([asMultiple(owner)], { owner: ['48', '9999'] }),
    ).resolves.toEqual({ owner: ['rec_ada', '9999'] })
  })

  it('queries once per distinct target table, never once per value', async () => {
    found([])

    await RelationService.resolveFilterTargets([asMultiple(owner), reviewer], {
      owner: ['1', '2', '3'],
      reviewer: '4',
    })

    expect(prismaMock.record.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.record.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tableId: 'tbl_people', number: { in: [1, 2, 3, 4] } },
      }),
    )
  })

  it('touches nothing when no relation is filtered', async () => {
    const filters = { company: 'Acme' }

    await expect(RelationService.resolveFilterTargets([textField()], filters)).resolves.toBe(
      filters,
    )
    expect(prismaMock.record.findMany).not.toHaveBeenCalled()
  })

  it('leaves every other field’s filter untouched', async () => {
    found([{ id: 'rec_ada', number: 48 }])

    await expect(
      RelationService.resolveFilterTargets([owner, textField()], {
        owner: '48',
        company: 'Acme',
      }),
    ).resolves.toEqual({ owner: 'rec_ada', company: 'Acme' })
  })
})

describe('RelationService.assertRelationTargets', () => {
  it('passes silently when there is nothing linked', async () => {
    await expect(RelationService.assertRelationTargets([owner], {}, REACH)).resolves.toBeUndefined()
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('accepts an id the target table really holds', async () => {
    prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada')])

    await expect(
      RelationService.assertRelationTargets([owner], { owner: 'rec_1' }, REACH),
    ).resolves.toBeUndefined()
  })

  it('rejects a crafted id, naming the field it came in on', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await expect(
      RelationService.assertRelationTargets([owner], { owner: 'rec_forged' }, REACH),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'owner: the linked record no longer exists',
    })
  })

  it('rejects when only some of a widened field’s ids resolve', async () => {
    prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada')])

    await expect(
      RelationService.assertRelationTargets(
        [asMultiple(owner)],
        { owner: ['rec_1', 'rec_gone'] },
        REACH,
      ),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  describe('a caller who reads only their own records of the target', () => {
    it('may link to a record they created', async () => {
      prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada', 'usr_me')])

      await expect(
        RelationService.assertRelationTargets([owner], { owner: 'rec_1' }, OWN_PEOPLE),
      ).resolves.toBeUndefined()
    })

    it('may not link to another’s record, which they cannot see', async () => {
      prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada', 'usr_other')])

      await expect(
        RelationService.assertRelationTargets([owner], { owner: 'rec_1' }, OWN_PEOPLE),
      ).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'owner: you can only link to your own records',
      })
    })

    it('keeps a link to another’s record that the record already holds', async () => {
      prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada', 'usr_other')])
      const findStoredData = vi.fn().mockResolvedValue({ owner: 'rec_1' })

      await expect(
        RelationService.assertRelationTargets(
          [owner],
          { owner: 'rec_1' },
          OWN_PEOPLE,
          findStoredData,
        ),
      ).resolves.toBeUndefined()
      expect(findStoredData).toHaveBeenCalledTimes(1)
    })

    it('reads the stored data only when a link reaches past their sight', async () => {
      prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada', 'usr_me')])
      const findStoredData = vi.fn()

      await RelationService.assertRelationTargets(
        [owner],
        { owner: 'rec_1' },
        OWN_PEOPLE,
        findStoredData,
      )

      expect(findStoredData).not.toHaveBeenCalled()
    })
  })
})

describe('RelationService.listRelationOptions', () => {
  it('has nothing to offer for a field with no target', async () => {
    await expect(
      RelationService.listRelationOptions(relationField({ targetTableId: undefined }), REACH),
    ).resolves.toEqual([])
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('offers each candidate as its id, its number and its label', async () => {
    prismaMock.$queryRaw.mockResolvedValue([labelRow('rec_1', 1, 'Ada'), labelRow('rec_2', 2)])

    await expect(RelationService.listRelationOptions(owner, REACH)).resolves.toEqual([
      { id: 'rec_1', number: 1, label: 'Ada' },
      { id: 'rec_2', number: 2, label: null },
    ])
  })

  it('projects only the label field for its candidates', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner, REACH)

    expect(labelQueries()[0]?.text).toContain('data -> $1::text AS label')
    expect(labelQueries()[0]?.text).not.toMatch(/"number", data FROM/)
  })

  it('binds the target table and the cap as parameters', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner, REACH)

    const values = prismaMock.$queryRaw.mock.calls[0]?.slice(1)
    expect(values).toContain('tbl_people')
    expect(values).toContain(RELATION_OPTIONS_LIMIT)
  })

  it('pushes a search term into the query as a bound pattern', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner, REACH, 'ada')

    expect(boundValues(prismaMock.$queryRaw.mock.calls[0] ?? [])).toContain('%ada%')
  })

  it('offers only the caller’s own records of a target they read only partly', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner, OWN_PEOPLE)

    const query = sqlOf(prismaMock.$queryRaw.mock.calls[0])
    expect(query.text).toContain('"createdById" =')
    expect(query.values).toContain('usr_me')
  })

  it('adds no search fragment at all when nothing was typed', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await RelationService.listRelationOptions(owner, REACH)

    expect(boundValues(prismaMock.$queryRaw.mock.calls[0] ?? [])).not.toContain('%%')
  })
})
