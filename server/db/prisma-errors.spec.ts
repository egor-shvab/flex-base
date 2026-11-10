import { describe, expect, it } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { isMissingRow, isUniqueViolation } from '#server/db/prisma-errors'

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Constraint failed', {
    code,
    clientVersion: '7.9.0',
  })
}

describe('the Prisma fault predicates', () => {
  it('recognises a unique-constraint violation', () => {
    expect(isUniqueViolation(prismaError('P2002'))).toBe(true)
    expect(isMissingRow(prismaError('P2002'))).toBe(false)
  })

  it('recognises an operation on a missing row', () => {
    expect(isMissingRow(prismaError('P2025'))).toBe(true)
    expect(isUniqueViolation(prismaError('P2025'))).toBe(false)
  })

  it('claims nothing about an unrecognised Prisma code', () => {
    expect(isUniqueViolation(prismaError('P2003'))).toBe(false)
    expect(isMissingRow(prismaError('P2003'))).toBe(false)
  })

  it('claims nothing about anything that is not a Prisma error', () => {
    for (const value of [
      new Error('Connection reset'),
      'boom',
      null,
      undefined,
      { code: 'P2002' },
    ]) {
      expect(isUniqueViolation(value)).toBe(false)
      expect(isMissingRow(value)).toBe(false)
    }
  })
})
