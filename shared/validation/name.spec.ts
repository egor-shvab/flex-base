import { describe, expect, it } from 'vitest'
import { nameSchema } from '#shared/validation/name'

describe('nameSchema', () => {
  it('trims', () => {
    expect(nameSchema.parse('  Deals  ')).toBe('Deals')
  })

  it('rejects a name that is blank once trimmed', () => {
    expect(nameSchema.safeParse('').success).toBe(false)
    expect(nameSchema.safeParse('   ').success).toBe(false)
  })

  it('bounds the length at 100 characters, measured after trimming', () => {
    expect(nameSchema.safeParse('x'.repeat(100)).success).toBe(true)
    expect(nameSchema.safeParse('x'.repeat(101)).success).toBe(false)
    expect(nameSchema.safeParse(`  ${'x'.repeat(100)}  `).success).toBe(true)
  })

  it('rejects a non-string', () => {
    expect(nameSchema.safeParse(42).success).toBe(false)
    expect(nameSchema.safeParse(null).success).toBe(false)
  })
})
