import { describe, expect, it } from 'vitest'
import { buildRecordLabel, formatLinkedRecord } from '#shared/utils/record-label'

const record = (data: Record<string, unknown>, number = 42) =>
  ({ number, data }) as Parameters<typeof buildRecordLabel>[0]

describe('buildRecordLabel', () => {
  it('reads the named label field', () => {
    expect(buildRecordLabel(record({ full_name: 'Ada Lovelace' }), 'full_name')).toBe(
      'Ada Lovelace',
    )
  })

  it('reads as nothing when no label field is named', () => {
    expect(buildRecordLabel(record({ full_name: 'Ada Lovelace' }))).toBeNull()
  })

  it('reads as nothing when the label field is blank, missing or null', () => {
    expect(buildRecordLabel(record({ full_name: '' }), 'full_name')).toBeNull()
    expect(buildRecordLabel(record({ full_name: null }), 'full_name')).toBeNull()
    expect(buildRecordLabel(record({}), 'full_name')).toBeNull()
  })

  it('reads as nothing when the label field was deleted from the target table', () => {
    expect(buildRecordLabel(record({ other: 'x' }), 'gone')).toBeNull()
  })

  it('stringifies a non-string value rather than showing nothing', () => {
    expect(buildRecordLabel(record({ amount: 0 }), 'amount')).toBe('0')
    expect(buildRecordLabel(record({ active: false }), 'active')).toBe('false')
  })

  it('joins a multi-value label rather than rendering its JSON', () => {
    // Reachable because a field already serving as a label can be widened afterwards
    expect(buildRecordLabel(record({ tags: ['a', 'b'] }), 'tags')).toBe('a, b')
  })

  it('reads as nothing for an empty list', () => {
    expect(buildRecordLabel(record({ tags: [] }), 'tags')).toBeNull()
  })
})

describe('formatLinkedRecord', () => {
  it('states the number before the label', () => {
    expect(formatLinkedRecord({ number: 3, label: 'Example' })).toBe('#3 Example')
  })

  it('states the number alone when nothing names the record', () => {
    expect(formatLinkedRecord({ number: 3, label: null })).toBe('#3')
  })

  /** The regression this split fixes: a blank label used to arrive already carrying `#3`. */
  it('states the number once for a record with no label field value', () => {
    const blank = record({ full_name: '' }, 3)

    expect(formatLinkedRecord({ number: 3, label: buildRecordLabel(blank, 'full_name') })).toBe(
      '#3',
    )
  })
})
