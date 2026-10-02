import { describe, expect, it } from 'vitest'
import type { IField } from '#shared/types/field'
import type { TFilterValue } from '#shared/types/filter'
import type { ILinkedRecord } from '#shared/types/record'
import { FILTER_SUMMARIES, summaryFor } from '~/field-types/registry'
import type { IFilterSummaryContext } from '~/field-types/types'
import {
  asMultiple,
  booleanField,
  dateField,
  numberField,
  relationField,
  selectField,
  textField,
} from '~~/test/fixtures'

const REFS: Record<number, ILinkedRecord> = {
  7: { number: 7, label: 'Ada Lovelace' },
  9: { number: 9, label: 'Grace Hopper' },
  11: { number: 11, label: null },
}

const BY_ID: Record<string, ILinkedRecord> = { rec_ada: REFS[7] as ILinkedRecord }

const ctx: IFilterSummaryContext = {
  linkedRecordByNumber: (_fieldId, number) => REFS[number],
  linkedRecordFor: (_fieldId, recordId) => BY_ID[recordId],
}

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

  it('resolves a single id to its number and label', () => {
    expect(summarise(field, '7')).toBe('is #7 Ada Lovelace')
  })

  it('states the number alone for a record nothing names', () => {
    expect(summarise(field, '11')).toBe('is #11')
  })

  it('degrades an unresolvable id rather than showing it', () => {
    expect(summarise(field, '404')).toBe('is Unknown record')
  })

  it('names the target of a link that still carries a cuid', () => {
    expect(summarise(field, 'rec_ada')).toBe('is #7 Ada Lovelace')
  })

  describe('holding several', () => {
    const multi = asMultiple(relationField())

    it('resolves one id as an equality', () => {
      expect(summarise(multi, ['7'])).toBe('is #7 Ada Lovelace')
    })

    it('resolves several as an any-of', () => {
      expect(summarise(multi, ['7', '9'])).toBe('is any of #7 Ada Lovelace, #9 Grace Hopper')
    })

    it('degrades per entry, keeping the ones it can resolve', () => {
      expect(summarise(multi, ['7', '404'])).toBe('is any of #7 Ada Lovelace, Unknown record')
    })

    it('says nothing for an empty selection', () => {
      expect(summarise(multi, [])).toBe('')
    })
  })
})

describe('summaryFor', () => {
  it('picks the multi entry only for a type that has one', () => {
    const single = relationField()
    const multi = asMultiple(relationField())

    expect(summarise(single, '7')).toBe('is #7 Ada Lovelace')
    expect(summarise(multi, ['7'])).toBe('is #7 Ada Lovelace')
    expect(summaryFor(single)).not.toBe(summaryFor(multi))
  })

  it('falls through to the flat entry for a multi SELECT', () => {
    expect(summaryFor(asMultiple(selectField()))).toBe(FILTER_SUMMARIES.SELECT)
  })

  it('ignores multiple on a type that cannot hold several', () => {
    const field = asMultiple(textField())

    expect(summaryFor(field)).toBe(FILTER_SUMMARIES.TEXT)
    expect(summarise(field, 'acme')).toBe('contains acme')
  })
})
