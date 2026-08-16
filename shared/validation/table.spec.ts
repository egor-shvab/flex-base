import { describe, expect, it } from 'vitest'
import { tableInputSchema } from '#shared/validation/table'

describe('tableInputSchema', () => {
  it('accepts a trimmed name and drops anything else', () => {
    expect(tableInputSchema.parse({ name: '  Deals  ', id: 'crafted' })).toEqual({ name: 'Deals' })
  })

  it('inherits the shared name rule, so a table and a field cannot drift apart', () => {
    expect(tableInputSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(tableInputSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false)
  })

  it('requires the name', () => {
    expect(tableInputSchema.safeParse({}).success).toBe(false)
  })
})
