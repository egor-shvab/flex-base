import { describe, expect, it } from 'vitest'
import { tableSchema } from '#shared/validation/table'

describe('tableSchema', () => {
  it('accepts a trimmed name and drops anything else', () => {
    expect(tableSchema.parse({ name: '  Deals  ', id: 'crafted' })).toEqual({ name: 'Deals' })
  })

  it('inherits the shared name rule, so a table and a field cannot drift apart', () => {
    expect(tableSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(tableSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false)
  })

  it('requires the name', () => {
    expect(tableSchema.safeParse({}).success).toBe(false)
  })
})
