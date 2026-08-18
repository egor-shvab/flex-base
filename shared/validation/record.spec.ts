import { describe, expect, it } from 'vitest'
import { FIELD_TYPES } from '#shared/field-types/registry'
import { FILTER_VALUES_MAX, SEARCH_MIN_LENGTH } from '#shared/constants/filter'
import {
  MULTI_VALUE_MAX_ITEMS,
  RECORD_PAGE_SIZE,
  RECORD_PAGE_SIZE_MAX,
} from '#shared/constants/record'
import type { IField } from '#shared/types/field'
import {
  blankValueFor,
  buildFilterValueSchema,
  buildRecordQuerySchema,
  buildRecordSchema,
} from '#shared/validation/record'
import {
  ALL_TYPE_FIELDS,
  asMultiple,
  booleanField,
  dateField,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

/** The first issue path of a failed parse, which is what a form binds its message to. */
function issuePaths(schema: { safeParse: (value: unknown) => unknown }, value: unknown): string[] {
  const result = schema.safeParse(value) as {
    success: boolean
    error?: { issues: { path: PropertyKey[] }[] }
  }
  expect(result.success).toBe(false)
  return result.error!.issues.map((issue) => issue.path.join('.'))
}

describe('blankValueFor', () => {
  it('is null for every type that can actually be missing', () => {
    for (const type of FIELD_TYPES) {
      const expected = type === 'BOOLEAN' ? false : null
      expect(blankValueFor(ALL_TYPE_FIELDS[type])).toBe(expected)
    }
  })

  it('is false for a checkbox, which is never "missing"', () => {
    expect(blankValueFor(booleanField())).toBe(false)
  })

  it('is the empty list for a multi-value field', () => {
    expect(blankValueFor(asMultiple(selectField()))).toEqual([])
    expect(blankValueFor(asMultiple(relationField()))).toEqual([])
  })
})

describe('buildRecordSchema — shape', () => {
  it('strips keys the table does not declare', () => {
    const schema = buildRecordSchema([textField('company')])
    expect(schema.parse({ company: 'acme', crafted: 'dropped' })).toEqual({ company: 'acme' })
  })

  it("seeds an omitted value with its type's blank", () => {
    const schema = buildRecordSchema([textField('company'), booleanField('active')])
    expect(schema.parse({})).toEqual({ company: null, active: false })
  })

  it("reads a blank control as the type's blank value", () => {
    const schema = buildRecordSchema([textField('company'), booleanField('active')])
    expect(schema.parse({ company: '', active: '' })).toEqual({ company: null, active: false })
  })
})

describe('buildRecordSchema — per type', () => {
  const parseOne = (field: IField, value: unknown) =>
    buildRecordSchema([field]).safeParse({ [field.key]: value })

  it('trims TEXT and bounds it at 1000 characters', () => {
    expect(parseOne(textField(), '  acme  ')).toMatchObject({ data: { company: 'acme' } })
    expect(parseOne(textField(), 'x'.repeat(1000)).success).toBe(true)
    expect(parseOne(textField(), 'x'.repeat(1001)).success).toBe(false)
  })

  it('requires NUMBER to be a finite number, not a numeric string', () => {
    expect(parseOne(numberField(), 42).success).toBe(true)
    expect(parseOne(numberField(), 0).success).toBe(true)
    expect(parseOne(numberField(), -1.5).success).toBe(true)
    expect(parseOne(numberField(), '42').success).toBe(false)
    expect(parseOne(numberField(), Number.NaN).success).toBe(false)
    expect(parseOne(numberField(), Number.POSITIVE_INFINITY).success).toBe(false)
  })

  it('accepts an ISO date and rejects any other shape', () => {
    expect(parseOne(dateField(), '2026-01-31').success).toBe(true)
    expect(parseOne(dateField(), '2026-1-31').success).toBe(false)
    expect(parseOne(dateField(), '31/01/2026').success).toBe(false)
  })

  it('accepts only a choice the SELECT offers', () => {
    expect(parseOne(selectField(['Won', 'Lost']), 'Won').success).toBe(true)
    expect(parseOne(selectField(['Won', 'Lost']), 'Renamed').success).toBe(false)
  })

  it('requires a RELATION value to be a non-empty id', () => {
    expect(parseOne(relationField(), 'rec_1').success).toBe(true)
    // `''` preprocesses to the blank value, so it reads as "no link" rather than as a bad id
    expect(parseOne(relationField(), '').success).toBe(true)
    expect(parseOne(relationField(), '   ')).toMatchObject({ success: true })
  })
})

describe('buildRecordSchema — required', () => {
  it('rejects a missing value on a required field', () => {
    expect(issuePaths(buildRecordSchema([textField('company', { required: true })]), {})).toEqual([
      'company',
    ])
  })

  it('is a documented no-op on a checkbox, since `false` is a real value', () => {
    const schema = buildRecordSchema([booleanField('active', { required: true })])
    expect(schema.parse({ active: false })).toEqual({ active: false })
    expect(schema.parse({})).toEqual({ active: false })
  })

  it('accepts a filled-in value', () => {
    const schema = buildRecordSchema([textField('company', { required: true })])
    expect(schema.parse({ company: 'acme' })).toEqual({ company: 'acme' })
  })
})

describe('buildRecordSchema — multi-value', () => {
  const multiSelect = asMultiple(selectField(['Won', 'Lost', 'Open']))
  const parseList = (field: IField, value: unknown) =>
    buildRecordSchema([field]).safeParse({ [field.key]: value })

  it("accepts a list of the field's own choices", () => {
    expect(parseList(multiSelect, ['Won', 'Lost'])).toMatchObject({
      data: { stage: ['Won', 'Lost'] },
    })
  })

  it('reads a blank control, a null and an omission all as the empty list', () => {
    expect(parseList(multiSelect, '')).toMatchObject({ data: { stage: [] } })
    expect(parseList(multiSelect, null)).toMatchObject({ data: { stage: [] } })
    expect(buildRecordSchema([multiSelect]).parse({})).toEqual({ stage: [] })
  })

  it('rejects duplicates rather than deduplicating them', () => {
    // A control cannot produce them, so a repeat is a crafted payload and is answered
    expect(parseList(multiSelect, ['Won', 'Won']).success).toBe(false)
  })

  it('rejects an element the field does not offer', () => {
    expect(parseList(multiSelect, ['Won', 'Renamed']).success).toBe(false)
  })

  it(`bounds the list at ${MULTI_VALUE_MAX_ITEMS} values`, () => {
    const ids = Array.from({ length: MULTI_VALUE_MAX_ITEMS + 1 }, (_, index) => `rec_${index}`)
    const multiRelation = asMultiple(relationField())

    expect(parseList(multiRelation, ids.slice(0, MULTI_VALUE_MAX_ITEMS)).success).toBe(true)
    expect(parseList(multiRelation, ids).success).toBe(false)
  })

  it('means non-empty when the field is required', () => {
    const required = asMultiple(selectField(['Won'], { required: true }))
    expect(parseList(required, []).success).toBe(false)
    expect(parseList(required, ['Won']).success).toBe(true)
  })
})

describe('buildFilterValueSchema — the query-string seam', () => {
  it('decodes a NUMBER from its string form', () => {
    expect(buildFilterValueSchema(numberField()).parse('42')).toBe(42)
    expect(buildFilterValueSchema(numberField()).safeParse('abc').success).toBe(false)
  })

  it('decodes a BOOLEAN as "true or not"', () => {
    const schema = buildFilterValueSchema(booleanField())
    expect(schema.parse('true')).toBe(true)
    expect(schema.parse('false')).toBe(false)
    expect(schema.parse('anything')).toBe(false)
  })

  it('passes the string types through untouched', () => {
    expect(buildFilterValueSchema(textField()).parse('acme')).toBe('acme')
    expect(buildFilterValueSchema(dateField()).parse('2026-01-31')).toBe('2026-01-31')
    expect(buildFilterValueSchema(selectField(['Won'])).parse('Won')).toBe('Won')
    expect(buildFilterValueSchema(relationField()).parse('rec_1')).toBe('rec_1')
  })

  it('is not nullable — unlike a record value, a filter bound is either present or absent', () => {
    expect(buildFilterValueSchema(textField()).safeParse(null).success).toBe(false)
    expect(buildFilterValueSchema(relationField()).safeParse('').success).toBe(false)
  })

  it('rejects a value the field does not offer', () => {
    expect(buildFilterValueSchema(selectField(['Won'])).safeParse('Nope').success).toBe(false)
    expect(buildFilterValueSchema(dateField()).safeParse('2026-1-1').success).toBe(false)
  })
})

describe('buildRecordQuerySchema — base params', () => {
  const schema = buildRecordQuerySchema([textField('company'), selectField(['Won', 'Lost'])])

  it('defaults pagination and direction', () => {
    expect(schema.parse({})).toMatchObject({
      page: 1,
      pageSize: RECORD_PAGE_SIZE,
      dir: 'desc',
    })
  })

  it('coerces page and pageSize from their string form', () => {
    expect(schema.parse({ page: '3', pageSize: '20' })).toMatchObject({ page: 3, pageSize: 20 })
  })

  it(`caps pageSize at ${RECORD_PAGE_SIZE_MAX}, so no request can ask for a whole table`, () => {
    expect(schema.safeParse({ pageSize: String(RECORD_PAGE_SIZE_MAX) }).success).toBe(true)
    expect(schema.safeParse({ pageSize: String(RECORD_PAGE_SIZE_MAX + 1) }).success).toBe(false)
    expect(schema.safeParse({ pageSize: '0' }).success).toBe(false)
  })

  it('rejects a page below 1', () => {
    expect(schema.safeParse({ page: '0' }).success).toBe(false)
    expect(schema.safeParse({ page: '-1' }).success).toBe(false)
  })

  it(`enforces the ${SEARCH_MIN_LENGTH}-character search floor`, () => {
    // An unanchored ILIKE across every column must never be triggerable by one character
    expect(schema.safeParse({ search: 'a' }).success).toBe(false)
    expect(schema.safeParse({ search: 'ac' }).success).toBe(true)
    expect(schema.safeParse({}).success).toBe(true)
  })

  it('bounds the search term', () => {
    expect(schema.safeParse({ search: 'x'.repeat(1001) }).success).toBe(false)
  })

  it('reads a blank search as absent rather than answering a 400', () => {
    // `?search=` is what a cleared box looks like in a link, and `parseRecordQueryState` has
    // always read it as "not searching" — the floor must not fire on a term that is not there
    for (const search of ['', '   ']) {
      expect(schema.parse({ search }).search).toBeUndefined()
    }
  })

  it('still applies the floor and the trim to a term that is really there', () => {
    expect(schema.parse({ search: '  acme  ' }).search).toBe('acme')
    expect(schema.safeParse({ search: '  a  ' }).success).toBe(false)
  })
})

describe('buildRecordQuerySchema — sorting', () => {
  const schema = buildRecordQuerySchema([textField('company')])

  it("accepts a table's own field and the record's own columns", () => {
    for (const sort of ['company', 'recordNumber', 'createdAt', 'updatedAt']) {
      expect(schema.safeParse({ sort }).success).toBe(true)
    }
  })

  it('rejects an unknown sort key at its own path', () => {
    expect(issuePaths(schema, { sort: 'deleted_field' })).toEqual(['sort'])
  })

  it('rejects a direction outside asc/desc', () => {
    expect(issuePaths(schema, { dir: 'sideways' })).toEqual(['dir'])
  })
})

describe('buildRecordQuerySchema — filter params', () => {
  const schema = buildRecordQuerySchema([
    textField('company'),
    numberField('contract_value'),
    selectField(['Won', 'Lost']),
    asMultiple(relationField({}, { key: 'partners' })),
  ])

  it('accepts a well-formed query', () => {
    expect(
      schema.safeParse({
        company: 'acme',
        contract_value_from: '100',
        stage: ['Won', 'Lost'],
        partners: 'rec_1',
      }).success,
    ).toBe(true)
  })

  it('skips an empty filter param instead of judging it', () => {
    expect(schema.safeParse({ company: '', contract_value_from: '', stage: [''] }).success).toBe(
      true,
    )
  })

  it("rejects a malformed value at the param's own path", () => {
    expect(issuePaths(schema, { contract_value_from: 'abc' })).toEqual(['contract_value_from'])
    expect(issuePaths(schema, { stage: 'Nope' })).toEqual(['stage'])
  })

  it('rejects a repeat on a filter that takes a single value', () => {
    expect(issuePaths(schema, { company: ['a', 'b'] })).toEqual(['company'])
    expect(issuePaths(schema, { contract_value_from: ['1', '2'] })).toEqual(['contract_value_from'])
  })

  it('accepts a repeat on a list-shaped filter, including a multi-value RELATION', () => {
    expect(schema.safeParse({ stage: ['Won', 'Lost'] }).success).toBe(true)
    expect(schema.safeParse({ partners: ['rec_1', 'rec_2'] }).success).toBe(true)
  })

  it(`rejects more than ${FILTER_VALUES_MAX} values on one filter`, () => {
    const ids = Array.from({ length: FILTER_VALUES_MAX + 1 }, (_, index) => `rec_${index}`)

    expect(schema.safeParse({ partners: ids.slice(0, FILTER_VALUES_MAX) }).success).toBe(true)
    expect(issuePaths(schema, { partners: ids })).toEqual(['partners'])
  })

  it('reports one issue per malformed list rather than one per bad entry', () => {
    expect(issuePaths(schema, { stage: ['Won', 'Nope', 'Also nope'] })).toEqual(['stage'])
  })

  it('does not reject a param the table has never heard of', () => {
    // A filter name is a plain field name now, so a stray `utm_source` is indistinguishable
    // from a typo and must not break the page
    expect(schema.safeParse({ utm_source: 'newsletter' }).success).toBe(true)
  })

  it('never judges a param a reserved name has already claimed', () => {
    const shadowed = buildRecordQuerySchema([textField('search'), textField('page')])
    expect(shadowed.safeParse({ page: '2' })).toMatchObject({ data: { page: 2 } })
  })
})
