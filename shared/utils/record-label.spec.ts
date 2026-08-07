import { describe, expect, it } from 'vitest'
import { buildRecordLabel } from '#shared/utils/record-label'

const record = (data: Record<string, unknown>, number = 42) =>
  ({ number, data }) as Parameters<typeof buildRecordLabel>[0]

describe('buildRecordLabel', () => {
  it('reads the named label field', () => {
    expect(buildRecordLabel(record({ full_name: 'Ada Lovelace' }), 'full_name')).toBe(
      'Ada Lovelace',
    )
  })

  it('falls back to the record number when no label field is named', () => {
    expect(buildRecordLabel(record({ full_name: 'Ada Lovelace' }))).toBe('#42')
  })

  it('falls back when the label field is blank, missing or null', () => {
    expect(buildRecordLabel(record({ full_name: '' }), 'full_name')).toBe('#42')
    expect(buildRecordLabel(record({ full_name: null }), 'full_name')).toBe('#42')
    expect(buildRecordLabel(record({}), 'full_name')).toBe('#42')
  })

  it('falls back when the label field was deleted from the target table', () => {
    expect(buildRecordLabel(record({ other: 'x' }), 'gone')).toBe('#42')
  })

  it('stringifies a non-string value rather than showing nothing', () => {
    expect(buildRecordLabel(record({ amount: 0 }), 'amount')).toBe('0')
    expect(buildRecordLabel(record({ active: false }), 'active')).toBe('false')
  })

  it('joins a multi-value label rather than rendering its JSON', () => {
    // Reachable because a field already serving as a label can be widened afterwards
    expect(buildRecordLabel(record({ tags: ['a', 'b'] }), 'tags')).toBe('a, b')
  })

  it('falls back to the number for an empty list', () => {
    expect(buildRecordLabel(record({ tags: [] }), 'tags')).toBe('#42')
  })
})
