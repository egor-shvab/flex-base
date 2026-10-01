import { describe, expect, it } from 'vitest'
import { toDescribedBy } from '~/utils/field-message'

describe('toDescribedBy', () => {
  it('points at the error while there is one', () => {
    expect(toDescribedBy('email', { error: 'Required', hint: 'Work address' })).toBe('email-error')
  })

  it('points at the hint when there is no error', () => {
    expect(toDescribedBy('email', { hint: 'Work address' })).toBe('email-hint')
  })

  it('describes nothing when neither line is shown', () => {
    expect(toDescribedBy('email', {})).toBeUndefined()
    expect(toDescribedBy('email', { error: '', hint: '' })).toBeUndefined()
  })
})
