import { describe, expect, it } from 'vitest'
import { toMessageId } from '~/utils/field-message'

describe('toMessageId', () => {
  it('names the error line while there is one', () => {
    expect(toMessageId('email', { error: 'Required', hint: 'Work address' })).toBe('email-error')
  })

  it('names the hint line when there is no error', () => {
    expect(toMessageId('email', { hint: 'Work address' })).toBe('email-hint')
  })

  it('names nothing when neither line is shown', () => {
    expect(toMessageId('email', {})).toBeUndefined()
    expect(toMessageId('email', { error: '', hint: '' })).toBeUndefined()
  })
})
