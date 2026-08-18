import { describe, expect, it } from 'vitest'
import { FIELD_TYPES, FILTER_VALUE_BY_TYPE } from '#shared/field-types/registry'
import {
  CREATED_AT_KEY,
  RECORD_NUMBER_KEY,
  RESERVED_QUERY_PARAMS,
  UPDATED_AT_KEY,
} from '#shared/constants/filter'
import {
  claimFilterParams,
  emptyFilterValueFor,
  filterableFields,
  filterParamNames,
  filterShapeFor,
  isFilterValueEmpty,
  isListFilterValue,
  isRangeFilterValue,
  isReservedParam,
  isScalarFilterValue,
  queryColumns,
  rangeParamName,
  withFilterValue,
} from '#shared/utils/filter'
import {
  ALL_TYPE_FIELDS,
  asMultiple,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

describe('queryColumns', () => {
  it('leads with the record number and trails with the timestamps', () => {
    // The order the table and the filter drawer both render from — a table's own data must
    // not be pushed to the right by the record's columns
    expect(queryColumns([textField('company')]).map((field) => field.key)).toEqual([
      RECORD_NUMBER_KEY,
      'company',
      CREATED_AT_KEY,
      UPDATED_AT_KEY,
    ])
  })

  it('yields the three record columns for a table with no fields', () => {
    expect(queryColumns([])).toHaveLength(3)
  })

  it('does not mutate the fields it was given', () => {
    const fields = [textField('company')]
    queryColumns(fields)
    expect(fields).toHaveLength(1)
  })
})

describe('filterShapeFor', () => {
  it('follows the type registry for a single-value field', () => {
    for (const type of FIELD_TYPES) {
      expect(filterShapeFor(ALL_TYPE_FIELDS[type])).toBe(FILTER_VALUE_BY_TYPE[type].shape)
    }
  })

  it('overrides a multi-value field to a list whatever its type declares', () => {
    // RELATION declares `scalar`; holding several targets makes "matches this one value"
    // a question that cannot be asked of it
    expect(FILTER_VALUE_BY_TYPE.RELATION.shape).toBe('scalar')
    expect(filterShapeFor(asMultiple(relationField()))).toBe('list')
    expect(filterShapeFor(asMultiple(selectField()))).toBe('list')
  })
})

describe('emptyFilterValueFor', () => {
  it('follows the type registry for a single-value field', () => {
    expect(emptyFilterValueFor(textField())).toBe('')
    expect(emptyFilterValueFor(numberField())).toEqual({ from: null, to: null })
    expect(emptyFilterValueFor(relationField())).toBe('')
  })

  it('is the empty list for a multi-value field', () => {
    expect(emptyFilterValueFor(asMultiple(relationField()))).toEqual([])
  })
})

describe('rangeParamName / filterParamNames', () => {
  it('spreads a range to two bounds', () => {
    expect(rangeParamName('contract_value', 'from')).toBe('contract_value_from')
    expect(rangeParamName('contract_value', 'to')).toBe('contract_value_to')
    expect(filterParamNames('contract_value', 'NUMBER')).toEqual([
      'contract_value_from',
      'contract_value_to',
    ])
    expect(filterParamNames('signed_on', 'DATE')).toEqual(['signed_on_from', 'signed_on_to'])
  })

  it('gives a scalar and a list the same single name — a list is that name repeated', () => {
    expect(filterParamNames('company', 'TEXT')).toEqual(['company'])
    expect(filterParamNames('stage', 'SELECT')).toEqual(['stage'])
    expect(filterParamNames('owner', 'RELATION')).toEqual(['owner'])
  })

  it("claims the same names whatever a field's cardinality, since it is keyed by type", () => {
    // What keeps it callable from `createField`, where only the type is known yet
    for (const type of FIELD_TYPES) {
      expect(filterParamNames('k', type).length).toBeGreaterThan(0)
    }
  })
})

describe('claimFilterParams', () => {
  it('tags each claimed param with the part of the value it carries', () => {
    expect(
      claimFilterParams([textField('company'), numberField('contract_value')]).map(
        ({ part, name }) => ({ part, name }),
      ),
    ).toEqual([
      { part: 'value', name: 'company' },
      { part: 'from', name: 'contract_value_from' },
      { part: 'to', name: 'contract_value_to' },
    ])
  })

  it('refuses every reserved param', () => {
    const claims = claimFilterParams(RESERVED_QUERY_PARAMS.map((key) => textField(key)))
    expect(claims).toEqual([])
  })

  it('gives a colliding key to the first field and skips the later one entirely', () => {
    // A legacy key created before the param format landed — deterministic rather than shared
    const first = textField('company', { id: 'fld_first' })
    const second = textField('company', { id: 'fld_second' })
    const claims = claimFilterParams([first, second])

    expect(claims).toHaveLength(1)
    expect(claims[0]?.field.id).toBe('fld_first')
  })

  it('lets a range field keep the bound that did not collide', () => {
    const claims = claimFilterParams([textField('value_from'), numberField('value')])
    expect(claims.map(({ name }) => name)).toEqual(['value_from', 'value_to'])
  })

  it('claims nothing for a field whose only name is reserved', () => {
    expect(claimFilterParams([textField('search'), textField('page')])).toEqual([])
  })
})

describe('isReservedParam', () => {
  it('is true for exactly the params the records URL owns', () => {
    for (const name of RESERVED_QUERY_PARAMS) {
      expect(isReservedParam(name)).toBe(true)
    }

    expect(isReservedParam('company')).toBe(false)
    // A range bound of a field keyed like a reserved param is a name of its own
    expect(isReservedParam('page_from')).toBe(false)
  })
})

describe('filterableFields', () => {
  it('keeps every field that claims a param, in order', () => {
    const fields = [textField('company'), numberField('contract_value'), selectField()]
    expect(filterableFields(fields)).toEqual(fields)
  })

  it('drops a field whose only param name is reserved', () => {
    // Its control could only ever discard what was typed into it — so none is rendered
    const fields = [textField('company'), textField('search'), textField('detail')]
    expect(filterableFields(fields).map((field) => field.key)).toEqual(['company'])
  })

  it('keeps a range field keyed like a reserved param — its bounds are not reserved', () => {
    expect(filterableFields([numberField('page')]).map((field) => field.key)).toEqual(['page'])
  })

  it('drops the field that lost a key collision, keeping the one that won it', () => {
    const first = textField('company', { id: 'fld_first' })
    const second = textField('company', { id: 'fld_second' })

    expect(filterableFields([first, second])).toEqual([first])
  })
})

describe('filter value guards', () => {
  it('separates a list from a range — an array is a non-null object too', () => {
    // Load-bearing, not defensive: without it a list would be read for bounds it has not got
    expect(isRangeFilterValue(['Won'])).toBe(false)
    expect(isListFilterValue(['Won'])).toBe(true)
    expect(isRangeFilterValue({ from: 1, to: 2 })).toBe(true)
    expect(isListFilterValue({ from: 1, to: 2 })).toBe(false)
  })

  it('treats null as neither a range nor a list', () => {
    expect(isRangeFilterValue(null)).toBe(false)
    expect(isListFilterValue(null)).toBe(false)
    expect(isScalarFilterValue(null)).toBe(true)
  })

  it('states the scalar shapes positively', () => {
    expect(isScalarFilterValue('acme')).toBe(true)
    expect(isScalarFilterValue(0)).toBe(true)
    expect(isScalarFilterValue(false)).toBe(true)
    expect(isScalarFilterValue([])).toBe(false)
    expect(isScalarFilterValue({ from: null, to: null })).toBe(false)
  })
})

describe('isFilterValueEmpty', () => {
  it('is true for every "not filtered" shape', () => {
    expect(isFilterValueEmpty(null)).toBe(true)
    expect(isFilterValueEmpty('')).toBe(true)
    expect(isFilterValueEmpty('   ')).toBe(true)
    expect(isFilterValueEmpty([])).toBe(true)
    expect(isFilterValueEmpty({ from: null, to: null })).toBe(true)
  })

  it('keeps `false` and `0`, which are real filter values', () => {
    expect(isFilterValueEmpty(false)).toBe(false)
    expect(isFilterValueEmpty(0)).toBe(false)
  })

  it('keeps a range with a single bound', () => {
    expect(isFilterValueEmpty({ from: 100, to: null })).toBe(false)
    expect(isFilterValueEmpty({ from: null, to: '2026-01-01' })).toBe(false)
  })

  it('keeps a non-empty list and a non-blank string', () => {
    expect(isFilterValueEmpty(['Won'])).toBe(false)
    expect(isFilterValueEmpty('acme')).toBe(false)
  })
})

describe('withFilterValue', () => {
  const columns = [textField('company'), selectField(['Won', 'Lost']), numberField('budget')]

  it('replaces the named column’s value and keeps the rest', () => {
    const next = withFilterValue(columns, { company: 'acme', stage: ['Won'] }, 'company', 'globex')

    expect(next).toEqual({ company: 'globex', stage: ['Won'] })
  })

  /**
   * The load-bearing property: the map is rebuilt in **column order**, not patched, so the same
   * selection always serializes to the same URL however it was clicked together.
   */
  it('rebuilds in column order rather than in the order keys were touched', () => {
    const touchedLast = withFilterValue(columns, { stage: ['Won'] }, 'company', 'acme')

    expect(Object.keys(touchedLast)).toEqual(['company', 'stage'])
  })

  it('drops the value when it is empty, which is how a filter is cleared', () => {
    const next = withFilterValue(columns, { company: 'acme', stage: ['Won'] }, 'stage', [])

    expect(next).toEqual({ company: 'acme' })
  })

  /** Blanking through `emptyFilterValueFor` is exactly what the summary's remove ✕ does. */
  it('clears a column given its type’s own empty value', () => {
    const stage = selectField(['Won', 'Lost'])
    const next = withFilterValue(columns, { stage: ['Won'] }, stage.key, emptyFilterValueFor(stage))

    expect(next).toEqual({})
  })

  it('drops every other empty value too, not only the one being changed', () => {
    const next = withFilterValue(
      columns,
      { company: '   ', budget: { from: null, to: null } },
      'stage',
      ['Lost'],
    )

    expect(next).toEqual({ stage: ['Lost'] })
  })

  /** A key the table does not own cannot be smuggled in — the walk is over the columns. */
  it('ignores a key no column claims', () => {
    expect(withFilterValue(columns, { company: 'acme' }, 'utm_source', 'x')).toEqual({
      company: 'acme',
    })
  })
})
