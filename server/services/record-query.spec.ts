import { describe, expect, it } from 'vitest'
import type { Prisma } from '#server/generated/prisma/client'
import {
  buildRecordLabelOrderBy,
  buildRecordLabelSearch,
  buildRecordOrderBy,
  buildRecordWhere,
} from '#server/services/record-query'
import { CREATED_AT_KEY, RECORD_NUMBER_KEY, UPDATED_AT_KEY } from '#shared/constants/filter'
import {
  asMultiple,
  booleanField,
  dateField,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

/**
 * The parameterised SQL a fragment carries, on one line. `.text` numbers its placeholders
 * `$1…$n`, so asserting on it pins both the shape of the SQL and the order values bind in —
 * without a connection, since nothing here executes.
 */
function sqlText(fragment: Prisma.Sql): string {
  return fragment.text.replace(/\s+/g, ' ').trim()
}

const TABLE_ID = 'tbl_deals'

describe('buildRecordWhere — scoping', () => {
  it('always scopes to the table first, so ownership cannot be filtered away', () => {
    const where = buildRecordWhere(TABLE_ID, [], {})

    expect(sqlText(where)).toBe('WHERE "tableId" = $1')
    expect(where.values).toEqual([TABLE_ID])
  })

  it('ANDs every filter onto that scope', () => {
    const where = buildRecordWhere(TABLE_ID, [textField('company')], { company: 'acme' })

    expect(sqlText(where)).toBe('WHERE "tableId" = $1 AND data ->> $2::text ILIKE $3')
    expect(where.values).toEqual([TABLE_ID, 'company', '%acme%'])
  })

  it('ignores a filter key the table does not own', () => {
    // The builder walks the fields, not the filter map, so a stray key has nothing to compare
    const where = buildRecordWhere(TABLE_ID, [textField('company')], { ghost: 'x' })
    expect(sqlText(where)).toBe('WHERE "tableId" = $1')
  })

  it('binds keys and values as parameters rather than interpolating them', () => {
    const where = buildRecordWhere(TABLE_ID, [textField('company')], { company: "'; DROP TABLE" })

    expect(sqlText(where)).not.toContain('DROP TABLE')
    expect(where.values).toContain("%'; DROP TABLE%")
  })
})

describe('buildRecordWhere — per type', () => {
  const whereFor = (field: Parameters<typeof buildRecordWhere>[1][number], value: unknown) =>
    buildRecordWhere(TABLE_ID, [field], { [field.key]: value as never })

  it('matches TEXT partially', () => {
    expect(sqlText(whereFor(textField(), 'acme'))).toContain('data ->> $2::text ILIKE $3')
  })

  it('casts NUMBER so 10 does not sort or compare below 9', () => {
    const where = whereFor(numberField(), { from: 100, to: 500 })

    expect(sqlText(where)).toBe(
      'WHERE "tableId" = $1 AND (data ->> $2::text)::numeric >= $3 AND (data ->> $4::text)::numeric <= $5',
    )
    expect(where.values).toEqual([TABLE_ID, 'contract_value', 100, 'contract_value', 500])
  })

  it('emits only the bound a range actually has', () => {
    expect(sqlText(whereFor(numberField(), { from: 100, to: null }))).toBe(
      'WHERE "tableId" = $1 AND (data ->> $2::text)::numeric >= $3',
    )
    expect(sqlText(whereFor(numberField(), { from: null, to: 500 }))).toBe(
      'WHERE "tableId" = $1 AND (data ->> $2::text)::numeric <= $3',
    )
  })

  it('drops a range with neither bound', () => {
    expect(sqlText(whereFor(numberField(), { from: null, to: null }))).toBe('WHERE "tableId" = $1')
  })

  it('casts BOOLEAN and compares it exactly', () => {
    const where = whereFor(booleanField(), false)

    expect(sqlText(where)).toBe('WHERE "tableId" = $1 AND (data ->> $2::text)::boolean = $3')
    expect(where.values).toEqual([TABLE_ID, 'active', false])
  })

  it('compares DATE as stored text, which is already chronological', () => {
    expect(sqlText(whereFor(dateField(), { from: '2026-01-01', to: '2026-12-31' }))).toBe(
      'WHERE "tableId" = $1 AND data ->> $2::text >= $3 AND data ->> $4::text <= $5',
    )
  })

  it("ORs a SELECT's chosen values through a self-parenthesising IN", () => {
    const where = whereFor(selectField(), ['Won', 'Lost'])

    expect(sqlText(where)).toBe('WHERE "tableId" = $1 AND data ->> $2::text IN ($3,$4)')
    expect(where.values).toEqual([TABLE_ID, 'stage', 'Won', 'Lost'])
  })

  it('drops an empty list rather than emitting `IN ()`', () => {
    expect(sqlText(whereFor(selectField(), []))).toBe('WHERE "tableId" = $1')
  })

  it('compares a RELATION on the id it stores', () => {
    const where = whereFor(relationField(), 'rec_1')

    expect(sqlText(where)).toBe('WHERE "tableId" = $1 AND data ->> $2::text = $3')
    expect(where.values).toEqual([TABLE_ID, 'owner', 'rec_1'])
  })
})

describe('buildRecordWhere — multi-value', () => {
  it('asks whether the stored list overlaps the filtered one', () => {
    // `jsonb_exists_any` is the function form of `?|` — a literal `?` is the placeholder token
    // on Prisma's other drivers and has a long history of being mangled
    const where = buildRecordWhere(TABLE_ID, [asMultiple(selectField())], {
      stage: ['Won', 'Lost'],
    })

    expect(sqlText(where)).toBe(
      'WHERE "tableId" = $1 AND jsonb_exists_any(data -> $2::text, ARRAY[$3,$4]::text[])',
    )
    expect(where.values).toEqual([TABLE_ID, 'stage', 'Won', 'Lost'])
  })

  it('projects to JSONB rather than to text, so a filter cannot match on `[` or `","`', () => {
    const where = buildRecordWhere(TABLE_ID, [asMultiple(relationField())], { owner: ['rec_1'] })

    expect(sqlText(where)).toContain('data -> $2::text')
    expect(sqlText(where)).not.toContain('data ->> $2::text')
  })

  it("is self-parenthesising, so it cannot bind to a sibling range's last bound", () => {
    const where = buildRecordWhere(TABLE_ID, [numberField(), asMultiple(selectField())], {
      contract_value: { from: 1, to: 2 },
      stage: ['Won'],
    })

    expect(sqlText(where)).toMatch(/AND jsonb_exists_any\(.+\)$/)
  })
})

describe("buildRecordWhere — the record's own columns", () => {
  it('filters the number as text, so 4 finds #4, #14 and #42', () => {
    const where = buildRecordWhere(TABLE_ID, [], { [RECORD_NUMBER_KEY]: '4' })

    expect(sqlText(where)).toBe('WHERE "tableId" = $1 AND "number"::text ILIKE $2')
    expect(where.values).toEqual([TABLE_ID, '%4%'])
  })

  it('filters a timestamp as a date, so an inclusive `to` covers that whole day', () => {
    const where = buildRecordWhere(TABLE_ID, [], {
      [CREATED_AT_KEY]: { from: '2026-01-01', to: '2026-01-01' },
    })

    expect(sqlText(where)).toBe(
      'WHERE "tableId" = $1 AND "createdAt"::date >= $2 AND "createdAt"::date <= $3',
    )
  })

  it('takes precedence over the type registry, since these live outside `data`', () => {
    const where = buildRecordWhere(TABLE_ID, [], {
      [UPDATED_AT_KEY]: { from: '2026-01-01', to: null },
    })
    expect(sqlText(where)).toContain('"updatedAt"::date')
    expect(sqlText(where)).not.toContain('data ->>')
  })
})

describe('buildRecordWhere — free-text search', () => {
  const table = [
    textField('company'),
    numberField(),
    booleanField(),
    relationField(),
    selectField(),
  ]

  it('adds no group when nothing is being searched', () => {
    expect(sqlText(buildRecordWhere(TABLE_ID, table, {}, ''))).toBe('WHERE "tableId" = $1')
  })

  it('wraps every arm in one parenthesised OR group', () => {
    const where = buildRecordWhere(TABLE_ID, table, {}, 'acme')
    expect(sqlText(where)).toMatch(/AND \(.+ OR .+\)$/)
  })

  it('keeps that group parenthesised beside a bare two-bound range', () => {
    // The load-bearing case: `withinRange` emits `a >= x AND a <= y` with no parentheses of
    // its own, so an unwrapped OR here would bind to its last bound and silently widen it
    const where = buildRecordWhere(TABLE_ID, table, { contract_value: { from: 1, to: 2 } }, 'acme')
    const text = sqlText(where)

    expect(text).toContain('::numeric >= $')
    expect(text).toContain('::numeric <= $')
    expect(text).toMatch(/AND \([^()]*ILIKE[^()]*OR .+\)$/)
  })

  it('searches TEXT, DATE, SELECT and the record number', () => {
    const text = sqlText(
      buildRecordWhere(TABLE_ID, [textField('company'), dateField()], {}, 'acme'),
    )

    expect(text).toContain('"number"::text ILIKE')
    // One arm per searchable column: the number, the text field and the date field
    expect(text.match(/ OR /g)).toHaveLength(2)
  })

  it('leaves BOOLEAN, RELATION and the timestamps out of the search', () => {
    // A BOOLEAN stores `true`/`false`, so searching `e` would match every unchecked record;
    // a RELATION stores a cuid; and `date ILIKE text` has no operator
    const text = sqlText(buildRecordWhere(TABLE_ID, [booleanField(), relationField()], {}, 'acme'))

    expect(text).toBe('WHERE "tableId" = $1 AND ("number"::text ILIKE $2)')
  })

  it('leaves a multi-value RELATION out too, which widening only strengthens', () => {
    // Matching labels would mean the correlated subquery once per link per row, against
    // every row — the count query has no LIMIT
    const text = sqlText(buildRecordWhere(TABLE_ID, [asMultiple(relationField())], {}, 'acme'))

    expect(text).toBe('WHERE "tableId" = $1 AND ("number"::text ILIKE $2)')
  })

  it('searches a multi-value SELECT element-wise, guarded against a scalar row', () => {
    // `jsonb_array_elements_text` raises on a scalar, and that error takes down the whole
    // list query — a row written before the field was widened must degrade, not 500
    const text = sqlText(buildRecordWhere(TABLE_ID, [asMultiple(selectField())], {}, 'acme'))

    expect(text).toContain("CASE WHEN jsonb_typeof(data -> $3::text) = 'array'")
    expect(text).toContain("ELSE '[]'::jsonb END")
    expect(text).toContain('EXISTS ( SELECT 1 FROM jsonb_array_elements_text(')
    expect(text).toContain('WHERE element ILIKE')
  })

  it('escapes the wildcards a user may legitimately type', () => {
    const where = buildRecordWhere(TABLE_ID, [textField('company')], {}, '100%_x')
    expect(where.values).toContain('%100\\%\\_x%')
  })

  it('escapes a backslash too, so the escape character cannot be smuggled in', () => {
    const where = buildRecordWhere(TABLE_ID, [textField('company')], {}, 'a\\b')
    expect(where.values).toContain('%a\\\\b%')
  })
})

describe('buildRecordOrderBy', () => {
  const table = [textField('company'), relationField()]

  it('orders by creation for the default key', () => {
    expect(sqlText(buildRecordOrderBy(table, { key: CREATED_AT_KEY, dir: 'desc' }))).toBe(
      '"createdAt" DESC',
    )
    expect(sqlText(buildRecordOrderBy(table, { key: CREATED_AT_KEY, dir: 'asc' }))).toBe(
      '"createdAt" ASC',
    )
  })

  it('falls back to creation for a key the table no longer owns', () => {
    expect(sqlText(buildRecordOrderBy(table, { key: 'deleted_field', dir: 'asc' }))).toBe(
      '"createdAt" ASC',
    )
  })

  it('sorts blanks last and breaks ties newest-first, which is what keeps paging stable', () => {
    expect(sqlText(buildRecordOrderBy(table, { key: 'company', dir: 'asc' }))).toBe(
      'data ->> $1::text ASC NULLS LAST, "createdAt" DESC',
    )
  })

  it('orders the number as an integer though it filters as text, so #9 precedes #10', () => {
    expect(sqlText(buildRecordOrderBy([], { key: RECORD_NUMBER_KEY, dir: 'asc' }))).toBe(
      '"number" ASC NULLS LAST, "createdAt" DESC',
    )
  })

  it('orders a timestamp as a timestamp, so two records made in one day still order by time', () => {
    expect(sqlText(buildRecordOrderBy([], { key: UPDATED_AT_KEY, dir: 'desc' }))).toBe(
      '"updatedAt" DESC NULLS LAST, "createdAt" DESC',
    )
  })

  it('orders a RELATION by the label the user reads, not by the id it stores', () => {
    const orderBy = buildRecordOrderBy(table, { key: 'owner', dir: 'asc' })

    expect(sqlText(orderBy)).toBe(
      '( SELECT target.data ->> $1::text FROM "Record" AS target WHERE target.id = "Record".data ->> $2::text ) ASC NULLS LAST, "createdAt" DESC',
    )
    expect(orderBy.values).toEqual(['full_name', 'owner'])
  })

  it('orders a multi-value RELATION by its first link', () => {
    const multi = asMultiple(relationField())
    expect(sqlText(buildRecordOrderBy([multi], { key: 'owner', dir: 'asc' }))).toContain(
      'target.id = "Record".data -> $2::text ->> 0',
    )
  })

  it('orders a multi-value SELECT by its first value', () => {
    const multi = asMultiple(selectField())
    expect(sqlText(buildRecordOrderBy([multi], { key: 'stage', dir: 'asc' }))).toBe(
      'data -> $1::text ->> 0 ASC NULLS LAST, "createdAt" DESC',
    )
  })

  it('falls back to the stored id when the label field was deleted', () => {
    const orphan = relationField({ labelFieldKey: undefined })
    expect(sqlText(buildRecordOrderBy([orphan], { key: 'owner', dir: 'asc' }))).toBe(
      '"Record".data ->> $1::text ASC NULLS LAST, "createdAt" DESC',
    )
  })
})

describe('buildRecordLabelOrderBy', () => {
  it('orders a picker alphabetically by the label the user will read', () => {
    expect(sqlText(buildRecordLabelOrderBy('full_name'))).toBe(
      'data ->> $1::text ASC NULLS LAST, "createdAt" DESC',
    )
  })

  it('falls back to newest-first with no label field', () => {
    expect(sqlText(buildRecordLabelOrderBy())).toBe('"createdAt" DESC')
  })
})

describe('buildRecordLabelSearch', () => {
  it('is null when nothing is being searched', () => {
    expect(buildRecordLabelSearch('full_name', '')).toBeNull()
  })

  it('matches the label field and the #number the label falls back to', () => {
    const search = buildRecordLabelSearch('full_name', 'ada')

    expect(sqlText(search!)).toBe(
      `(('#' || "number"::text) ILIKE $1 OR data ->> $2::text ILIKE $3)`,
    )
    expect(search?.values).toEqual(['%ada%', 'full_name', '%ada%'])
  })

  it('still matches the number when there is no label field', () => {
    const search = buildRecordLabelSearch(undefined, '42')

    expect(sqlText(search!)).toBe(`(('#' || "number"::text) ILIKE $1)`)
    expect(search?.values).toEqual(['%42%'])
  })

  it('escapes wildcards like the record search does', () => {
    expect(buildRecordLabelSearch('full_name', '50%')?.values).toContain('%50\\%%')
  })
})
