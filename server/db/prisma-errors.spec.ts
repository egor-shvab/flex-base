import { describe, expect, it } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { isMissingRow, isUniqueViolation, isUniqueViolationOn } from '#server/db/prisma-errors'

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

describe('isUniqueViolationOn', () => {
  const violationOn = (...fields: string[]) =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.9.0',
      meta: { driverAdapterError: { cause: { constraint: { fields } } } },
    })

  it('names the column the adapter reports, quoted as PostgreSQL quotes it', () => {
    expect(isUniqueViolationOn(violationOn('"publicId"'), 'publicId')).toBe(true)
    expect(isUniqueViolationOn(violationOn('email'), 'email')).toBe(true)
  })

  it('tells one column from another', () => {
    expect(isUniqueViolationOn(violationOn('email'), 'publicId')).toBe(false)
    expect(isUniqueViolationOn(violationOn('"publicId"'), 'email')).toBe(false)
  })

  it('claims nothing when the adapter reports no columns', () => {
    expect(isUniqueViolationOn(prismaError('P2002'), 'publicId')).toBe(false)
  })

  it('claims nothing about another fault on the same column', () => {
    expect(isUniqueViolationOn(prismaError('P2025'), 'publicId')).toBe(false)
  })
})
