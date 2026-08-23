import { describe, expect, it } from 'vitest'
import { buildFieldKey, slugify } from '#server/utils/field-key'
import { RESERVED_FIELD_KEYS, RESERVED_QUERY_PARAMS } from '#shared/constants/filter'
import type { IField } from '#shared/types/field'

type TExisting = Pick<IField, 'key' | 'type'>

const text = (key: string): TExisting => ({ key, type: 'TEXT' })
const number = (key: string): TExisting => ({ key, type: 'NUMBER' })

describe('slugify', () => {
  it('lowercases and joins words with an underscore', () => {
    expect(slugify('Company')).toBe('company')
    expect(slugify('Budget from')).toBe('budget_from')
    expect(slugify('Contract Value')).toBe('contract_value')
  })

  it('collapses a run of non-alphanumerics to a single underscore', () => {
    expect(slugify('Budget   from')).toBe('budget_from')
    expect(slugify('a---b')).toBe('a_b')
    expect(slugify('a / b . c')).toBe('a_b_c')
  })

  it('strips leading and trailing underscores', () => {
    expect(slugify('  Company  ')).toBe('company')
    expect(slugify('--Company--')).toBe('company')
    expect(slugify('_company_')).toBe('company')
  })

  it('keeps digits', () => {
    expect(slugify('2026')).toBe('2026')
    expect(slugify('Q4 2026')).toBe('q4_2026')
  })

  it('falls back to `field` when nothing survives', () => {
    expect(slugify('')).toBe('field')
    expect(slugify('   ')).toBe('field')
    expect(slugify('!!!')).toBe('field')
    expect(slugify('___')).toBe('field')
  })

  it('reduces a name with no ASCII alphanumerics to that same fallback', () => {
    // Deliberate — see `docs/limitations.md`
    expect(slugify('Компания')).toBe('field')
    expect(slugify('会社')).toBe('field')
    expect(slugify('🎯')).toBe('field')
  })

  it('emits only `^[a-z0-9_]+$`, which the SQL layer and the reserved keys both rely on', () => {
    const names = [
      'Company',
      "Owner's name",
      'Ünïcödé',
      'Компания',
      '会社',
      '🎯 target',
      'a/b\\c',
      '  ',
      '2026',
      '<script>alert(1)</script>',
      "'; DROP TABLE --",
      'a%b_c',
    ]

    for (const name of names) {
      expect(slugify(name)).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('can never emit a camelCase record column', () => {
    // Why `RESERVED_FIELD_KEYS` states the reservation rather than trusting this
    expect(slugify('Created At')).toBe('created_at')
    expect(slugify('Record Number')).toBe('record_number')

    for (const reserved of RESERVED_FIELD_KEYS) {
      expect(slugify(reserved)).not.toBe(reserved)
    }
  })
})

describe('buildFieldKey — a free name', () => {
  it('keeps its slug on an empty table', () => {
    expect(buildFieldKey('Company', 'TEXT', [])).toBe('company')
  })

  it('keeps its slug beside unrelated fields', () => {
    expect(buildFieldKey('Company', 'TEXT', [text('owner'), number('budget')])).toBe('company')
  })
})

describe('buildFieldKey — reserved names', () => {
  it('refuses a name that would shadow a records URL param', () => {
    // Documented in `docs/architecture.md`: a field called "Page" becomes `page_2`
    expect(buildFieldKey('Page', 'TEXT', [])).toBe('page_2')
    expect(buildFieldKey('Search', 'TEXT', [])).toBe('search_2')
    expect(buildFieldKey('Sort', 'TEXT', [])).toBe('sort_2')
  })

  it('refuses every reserved query param, whatever the field type', () => {
    for (const reserved of RESERVED_QUERY_PARAMS) {
      expect(buildFieldKey(reserved, 'TEXT', [])).not.toBe(reserved)
    }
  })

  it('needs no special case for the record columns, since slugify cannot emit them', () => {
    expect(buildFieldKey('Created At', 'DATE', [])).toBe('created_at')
    expect(buildFieldKey('Record Number', 'TEXT', [])).toBe('record_number')
  })
})

describe('buildFieldKey — collisions with an existing key', () => {
  it('suffixes a repeated name', () => {
    expect(buildFieldKey('Company', 'TEXT', [text('company')])).toBe('company_2')
  })

  it('keeps counting for each further repeat', () => {
    expect(buildFieldKey('Company', 'TEXT', [text('company'), text('company_2')])).toBe('company_3')
  })

  it('steps past a taken suffix rather than stopping at it', () => {
    expect(buildFieldKey('Company', 'TEXT', [text('company_2')])).toBe('company')
    expect(buildFieldKey('Company', 'TEXT', [text('company'), text('company_3')])).toBe('company_2')
  })
})

describe('buildFieldKey — collisions with a claimed range bound', () => {
  it("refuses a name taken by a NUMBER field's bound", () => {
    // Documented in `docs/architecture.md`: "Budget from" becomes `budget_from_2`
    // next to a NUMBER `budget`, because that field already claims `budget_from`
    expect(buildFieldKey('Budget from', 'TEXT', [number('budget')])).toBe('budget_from_2')
    expect(buildFieldKey('Budget to', 'TEXT', [number('budget')])).toBe('budget_to_2')
  })

  it('does the same for a DATE field, which is range-shaped too', () => {
    expect(buildFieldKey('Signed on from', 'TEXT', [{ key: 'signed_on', type: 'DATE' }])).toBe(
      'signed_on_from_2',
    )
  })

  it('leaves the name alone when the neighbour is not range-shaped', () => {
    // A TEXT `budget` claims only `budget`, so `budget_from` is free
    expect(buildFieldKey('Budget from', 'TEXT', [text('budget')])).toBe('budget_from')
  })

  it('refuses a new range field whose own bounds are taken', () => {
    // The new field claims `x_from` and `x_to`; an existing `x_from` blocks the whole key
    expect(buildFieldKey('X', 'NUMBER', [text('x_from')])).toBe('x_2')
    expect(buildFieldKey('X', 'NUMBER', [text('x_to')])).toBe('x_2')
  })

  it('lets a scalar field take a key whose bounds are taken, since it claims none', () => {
    expect(buildFieldKey('X', 'TEXT', [text('x_from')])).toBe('x')
  })

  it('checks the bounds of the suffixed candidate too, not only the base', () => {
    expect(buildFieldKey('X', 'NUMBER', [text('x'), text('x_2_from')])).toBe('x_3')
  })
})

describe('buildFieldKey — the non-ASCII fallback', () => {
  it('gives several non-ASCII names a deterministic sequence', () => {
    expect(buildFieldKey('Компания', 'TEXT', [])).toBe('field')
    expect(buildFieldKey('Отрасль', 'TEXT', [text('field')])).toBe('field_2')
    expect(buildFieldKey('会社', 'TEXT', [text('field'), text('field_2')])).toBe('field_3')
  })
})
