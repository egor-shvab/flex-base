import { describe, expect, it } from 'vitest'
import { fieldIndexes } from '#server/db/field-indexes'
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

describe('fieldIndexes — what a field asks for', () => {
  it('asks for nothing while the field is opted out', () => {
    expect(fieldIndexes(textField())).toEqual([])
  })

  it('gives TEXT a trigram for its filter, since ILIKE cannot use a B-tree', () => {
    const [filter, sortAsc, sortDesc] = fieldIndexes(indexed(textField('company')))

    expect(filter?.kind).toBe('trigram')
    expect(filter?.expression).toBe("data ->> 'company'::text")
    expect(sortAsc?.kind).toBe('btree')
    expect(sortDesc?.descending).toBe(true)
  })

  it('reuses a range type’s filter B-tree for the ascending sort, and adds only the descending one', () => {
    const indexes = fieldIndexes(indexed(numberField()))

    expect(indexes.map((index) => index.name.slice(-2))).toEqual(['_f', 'sd'])
    expect(indexes[0]?.expression).toBe("(data ->> 'contract_value'::text)::numeric")
    expect(indexes[0]?.descending).toBe(false)
    expect(indexes[1]?.expression).toBe(indexes[0]?.expression)
    expect(indexes[1]?.descending).toBe(true)
  })

  it('carries the cast into the expression, so the index matches the comparison', () => {
    expect(fieldIndexes(indexed(booleanField()))[0]?.expression).toBe(
      "(data ->> 'active'::text)::boolean",
    )
    expect(fieldIndexes(indexed(dateField()))[0]?.expression).toBe("data ->> 'signed_on'::text")
  })

  it('switches a widened SELECT from a B-tree to a GIN on the sub-path', () => {
    const single = fieldIndexes(indexed(selectField()))
    const multi = fieldIndexes(indexed(asMultiple(selectField())))

    expect(single[0]?.kind).toBe('btree')
    expect(multi[0]?.kind).toBe('gin')
    expect(multi[0]?.expression).toBe("data -> 'stage'::text")
    expect(multi.slice(1).map((index) => index.kind)).toEqual(['btree', 'btree'])
    expect(multi[1]?.expression).toBe("data -> 'stage' ->> 0")
  })

  it('gives RELATION a filter index and no sort index', () => {
    const indexes = fieldIndexes(indexed(relationField()))

    expect(indexes).toHaveLength(1)
    expect(indexes[0]?.name).toMatch(/_f$/)
    expect(indexes.some((index) => index.name.endsWith('_sa'))).toBe(false)
    expect(indexes.some((index) => index.name.endsWith('_sd'))).toBe(false)
  })

  it('names an index from the field id, not its key, and stays inside the identifier limit', () => {
    const id = 'cmsxxxxxxxxxxxxxxxxxxxxxx'
    const longKey = 'a'.repeat(100)
    const [index] = fieldIndexes(indexed(field({ id, key: longKey, type: 'NUMBER' })))

    expect(index?.name).toBe(`rec_idx_${id}_f`)
    expect(index?.name).not.toContain(longKey)
    expect(Buffer.byteLength(index?.name ?? '')).toBeLessThanOrEqual(63)
  })

  it('refuses a key that could not have come from slugify', () => {
    expect(() => fieldIndexes(indexed(field({ key: "x'; DROP TABLE", type: 'TEXT' })))).toThrow(
      /Unsafe field key/,
    )
  })
})
