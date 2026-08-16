import { describe, expect, it } from 'vitest'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { ILinkedRecord } from '#shared/types/record'
import { FILTER_SUMMARIES, summaryFor } from '~/field-types/filter-summaries'
import type { IFilterSummaryContext } from '~/field-types/filter-summaries'
import {
  asMultiple,
  booleanField,
  dateField,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

const REFS: Record<string, ILinkedRecord> = {
  rec_ada: { number: 7, label: 'Ada Lovelace' },
  rec_grace: { number: 9, label: 'Grace Hopper' },
  rec_blank: { number: 11, label: null },
}

const ctx: IFilterSummaryContext = {
  linkedRecordFor: (_fieldId, recordId) => REFS[recordId],
}

/** How one field's active filter actually reads — the resolver, not the raw registry entry. */
function summarise(field: IField, value: TFilterValue): string {
  return summaryFor(field)(value, field, ctx)
}

describe('TEXT', () => {
  it('reads as a substring match, because that is what it runs', () => {
    expect(summarise(textField(), 'acme')).toBe('contains acme')
  })

  it('coerces whatever arrives to text', () => {
    expect(summarise(textField(), 4)).toBe('contains 4')
  })
})

describe('NUMBER', () => {
  const field = numberField()

  it('states both bounds, formatted', () => {
    expect(summarise(field, { from: 1000, to: 5000 })).toBe('between 1,000 and 5,000')
  })

  /** Bounds are inclusive in the SQL, so "or more" is true where "above" would not be. */
  it('states a lower bound inclusively', () => {
    expect(summarise(field, { from: 1000, to: null })).toBe('1,000 or more')
  })

  it('states an upper bound inclusively', () => {
    expect(summarise(field, { from: null, to: 5000 })).toBe('5,000 or less')
  })

  it('says nothing for an unset range', () => {
    expect(summarise(field, { from: null, to: null })).toBe('')
  })

  it('says nothing for a value that is not a range at all', () => {
    expect(summarise(field, 'acme')).toBe('')
    expect(summarise(field, ['a', 'b'])).toBe('')
  })
})

describe('DATE', () => {
  const field = dateField()

  it('states both bounds in prose', () => {
    expect(summarise(field, { from: '2026-01-01', to: '2026-01-05' })).toBe(
      'between 1 Jan 2026 and 5 Jan 2026',
    )
  })

  it('states a lower bound as from', () => {
    expect(summarise(field, { from: '2026-01-01', to: null })).toBe('from 1 Jan 2026')
  })

  it('states an upper bound as until', () => {
    expect(summarise(field, { from: null, to: '2026-01-05' })).toBe('until 5 Jan 2026')
  })

  it('says nothing for an unset range', () => {
    expect(summarise(field, { from: null, to: null })).toBe('')
  })
})

describe('BOOLEAN', () => {
  const field = booleanField()

  it('reads as the same words the cell and the control use', () => {
    expect(summarise(field, true)).toBe('Yes')
    expect(summarise(field, false)).toBe('No')
  })

  /**
   * Deliberate, not a gap: only a strict `true` is Yes. A BOOLEAN filter is tri-state, and the
   * unset case is dropped before it reaches a summary, so there is no third phrasing to write.
   */
  it('treats anything other than a strict true as No', () => {
    expect(summarise(field, null)).toBe('No')
    expect(summarise(field, '')).toBe('No')
  })
})

describe('SELECT', () => {
  const field = selectField()

  it('reads one choice as the equality it is', () => {
    expect(summarise(field, ['Won'])).toBe('is Won')
  })

  /** Several read as the OR the SQL runs, rather than a count the user has to expand. */
  it('reads several choices as an any-of', () => {
    expect(summarise(field, ['Won', 'Lost'])).toBe('is any of Won, Lost')
  })

  it('says nothing for an empty selection', () => {
    expect(summarise(field, [])).toBe('')
  })

  it('says nothing for a value that is not a list', () => {
    expect(summarise(field, 'Won')).toBe('')
  })
})

describe('RELATION', () => {
  const field = relationField()

  /** Flat, because a chip's phrase is a string — the number is stated, not styled apart. */
  it('resolves a single id to its number and label', () => {
    expect(summarise(field, 'rec_ada')).toBe('is #7 Ada Lovelace')
  })

  it('states the number alone for a record nothing names', () => {
    expect(summarise(field, 'rec_blank')).toBe('is #11')
  })

  /** An id outside the capped candidate list resolves to nothing, and degrades like a cell. */
  it('degrades an unresolvable id rather than showing it', () => {
    expect(summarise(field, 'rec_deleted')).toBe('is Unknown record')
  })

  describe('holding several', () => {
    const multi = asMultiple(relationField())

    it('resolves one id as an equality', () => {
      expect(summarise(multi, ['rec_ada'])).toBe('is #7 Ada Lovelace')
    })

    it('resolves several as an any-of', () => {
      expect(summarise(multi, ['rec_ada', 'rec_grace'])).toBe(
        'is any of #7 Ada Lovelace, #9 Grace Hopper',
      )
    })

    it('degrades per entry, keeping the ones it can resolve', () => {
      expect(summarise(multi, ['rec_ada', 'rec_deleted'])).toBe(
        'is any of #7 Ada Lovelace, Unknown record',
      )
    })

    it('says nothing for an empty selection', () => {
      expect(summarise(multi, [])).toBe('')
    })
  })
})

/**
 * Cardinality is per-field, not per-type, so the resolver is where the two axes meet. Every
 * consumer calls `summaryFor` rather than indexing `FILTER_SUMMARIES`, and these are the three
 * ways that choice can go wrong.
 */
describe('summaryFor', () => {
  it('picks the multi entry only for a type that has one', () => {
    const single = relationField()
    const multi = asMultiple(relationField())

    // The same value, read by the two entries — proof they are genuinely different functions
    expect(summarise(single, 'rec_ada')).toBe('is #7 Ada Lovelace')
    expect(summarise(multi, ['rec_ada'])).toBe('is #7 Ada Lovelace')
    expect(summaryFor(single)).not.toBe(summaryFor(multi))
  })

  /** SELECT's flat summary is already list-shaped, so its override is `null` on purpose. */
  it('falls through to the flat entry for a multi SELECT', () => {
    expect(summaryFor(asMultiple(selectField()))).toBe(FILTER_SUMMARIES.SELECT)
  })

  /**
   * `MULTI_VALUE_BY_TYPE.TEXT` is `false`, so `options.multiple` on a TEXT field is not a thing
   * `isMultiValue` honours — the flag alone must not reroute the summary.
   */
  it('ignores multiple on a type that cannot hold several', () => {
    const field = asMultiple(textField())

    expect(summaryFor(field)).toBe(FILTER_SUMMARIES.TEXT)
    expect(summarise(field, 'acme')).toBe('contains acme')
  })
})
