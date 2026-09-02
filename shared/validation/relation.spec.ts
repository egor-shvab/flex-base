import { describe, expect, it } from 'vitest'
import { SEARCH_MIN_LENGTH } from '#shared/constants/filter'
import { relationOptionsQuerySchema } from '#shared/validation/relation'

describe('relationOptionsQuerySchema', () => {
  it('defaults an absent term to the empty one, meaning "the default list"', () => {
    expect(relationOptionsQuerySchema.parse({})).toEqual({ q: '' })
  })

  it('trims the term', () => {
    expect(relationOptionsQuerySchema.parse({ q: '  ada  ' })).toEqual({ q: 'ada' })
  })

  it('deliberately applies no minimum length', () => {
    // One expression over one table, a hard LIMIT and no count — a one-character term costs
    // exactly what the zero-character term this endpoint already serves costs
    expect(SEARCH_MIN_LENGTH).toBeGreaterThan(1)
    expect(relationOptionsQuerySchema.safeParse({ q: 'a' }).success).toBe(true)
    expect(relationOptionsQuerySchema.safeParse({ q: '' }).success).toBe(true)
  })

  it('bounds the pattern a caller can push into an ILIKE', () => {
    expect(relationOptionsQuerySchema.safeParse({ q: 'x'.repeat(100) }).success).toBe(true)
    expect(relationOptionsQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false)
  })

  it('rejects a repeated param, which arrives as an array', () => {
    expect(relationOptionsQuerySchema.safeParse({ q: ['ada', 'grace'] }).success).toBe(false)
  })
})
