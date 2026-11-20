import { describe, expect, it } from 'vitest'
import { buildFieldIndexes } from '#server/db/field-indexes'
import {
  asMultiple,
  booleanField,
  dateField,
  field,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

const indexed = <T extends { key: string }>(f: T) => ({ ...f, indexed: true })
const TABLE_ID = 'cmtablexxxxxxxxxxxxxxxxxx'

describe('buildFieldIndexes — what a field asks for', () => {
  it('asks for nothing while the field is opted out', () => {
    expect(buildFieldIndexes(TABLE_ID, textField())).toEqual([])
  })

  it('gives TEXT a trigram for its filter, since ILIKE cannot use a B-tree', () => {
    const [filter, sortAsc, sortDesc] = buildFieldIndexes(TABLE_ID, indexed(textField('company')))

    expect(filter?.kind).toBe('trigram')
    expect(filter?.expression).toBe("data ->> 'company'::text")
    expect(sortAsc?.kind).toBe('btree')
    expect(sortDesc?.isDescending).toBe(true)
  })

  it('reuses a range type’s filter B-tree for the ascending sort, and adds only the descending one', () => {
    const indexes = buildFieldIndexes(TABLE_ID, indexed(numberField()))

    expect(indexes.map((index) => index.name.slice(-2))).toEqual(['_f', 'sd'])
    expect(indexes[0]?.expression).toBe(
      "CASE WHEN jsonb_typeof(data -> 'contract_value'::text) = 'number' THEN (data ->> 'contract_value'::text)::numeric END",
    )
    expect(indexes[0]?.isDescending).toBe(false)
    expect(indexes[1]?.expression).toBe(indexes[0]?.expression)
    expect(indexes[1]?.isDescending).toBe(true)
  })

  it('carries the guarded cast into the expression, so the index matches the comparison', () => {
    expect(buildFieldIndexes(TABLE_ID, indexed(booleanField()))[0]?.expression).toBe(
      "CASE WHEN jsonb_typeof(data -> 'active'::text) = 'boolean' THEN (data ->> 'active'::text)::boolean END",
    )
    expect(buildFieldIndexes(TABLE_ID, indexed(dateField()))[0]?.expression).toBe(
      "data ->> 'signed_on'::text",
    )
  })

  it('switches a widened SELECT from a B-tree to a GIN on the sub-path', () => {
    const single = buildFieldIndexes(TABLE_ID, indexed(selectField()))
    const multi = buildFieldIndexes(TABLE_ID, indexed(asMultiple(selectField())))

    expect(single[0]?.kind).toBe('btree')
    expect(multi[0]?.kind).toBe('gin')
    expect(multi[0]?.expression).toBe("data -> 'stage'::text")
    expect(multi.slice(1).map((index) => index.kind)).toEqual(['btree', 'btree'])
    expect(multi[1]?.expression).toBe("data -> 'stage' ->> 0")
  })

  it('gives RELATION a filter index and no sort index', () => {
    const indexes = buildFieldIndexes(TABLE_ID, indexed(relationField()))

    expect(indexes).toHaveLength(1)
    expect(indexes[0]?.name).toMatch(/_f$/)
    expect(indexes.some((index) => index.name.endsWith('_sa'))).toBe(false)
    expect(indexes.some((index) => index.name.endsWith('_sd'))).toBe(false)
  })

  it('names an index from the field id, not its key, and stays inside the identifier limit', () => {
    const id = 'cmsxxxxxxxxxxxxxxxxxxxxxx'
    const longKey = 'a'.repeat(100)
    const [index] = buildFieldIndexes(
      TABLE_ID,
      indexed(field({ id, key: longKey, type: 'NUMBER' })),
    )

    expect(index?.name).toBe(`rec_idx_${id}_f`)
    expect(index?.name).not.toContain(longKey)
    expect(Buffer.byteLength(index?.name ?? '')).toBeLessThanOrEqual(63)
  })

  it('scopes every index to the table that owns the field', () => {
    const indexes = buildFieldIndexes(TABLE_ID, indexed(asMultiple(selectField())))

    expect(indexes.length).toBeGreaterThan(0)
    expect(indexes.every((index) => index.tableId === TABLE_ID)).toBe(true)
  })

  it('refuses a table id that could not have come from cuid', () => {
    expect(() => buildFieldIndexes("x' OR true", indexed(textField()))).toThrow(/Unsafe table id/)
  })

  it('refuses a key that could not have come from slugify', () => {
    expect(() =>
      buildFieldIndexes(TABLE_ID, indexed(field({ key: "x'; DROP TABLE", type: 'TEXT' }))),
    ).toThrow(/Unsafe field key/)
  })
})
