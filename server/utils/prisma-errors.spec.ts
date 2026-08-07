import { describe, expect, it } from 'vitest'
import { Prisma } from '#server/generated/prisma/client'
import { toHttpError } from '#server/utils/prisma-errors'

const messages = { conflict: 'A table with this name already exists', notFound: 'Table not found' }

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Constraint failed', {
    code,
    clientVersion: '7.9.0',
  })
}

/** The shape `createError` produces, as a caller reads it off the thrown value. */
function httpError(error: Error) {
  return error as Error & { statusCode?: number; statusMessage?: string }
}

describe('toHttpError — mapped constraint errors', () => {
  it('maps a unique-constraint violation to 409', () => {
    const result = httpError(toHttpError(prismaError('P2002'), messages))

    expect(result.statusCode).toBe(409)
    expect(result.statusMessage).toBe(messages.conflict)
  })

  it('maps an operation on a missing row to 404', () => {
    const result = httpError(toHttpError(prismaError('P2025'), messages))

    expect(result.statusCode).toBe(404)
    expect(result.statusMessage).toBe(messages.notFound)
  })

  it('returns the error rather than throwing it — every call site supplies the `throw`', () => {
    expect(() => toHttpError(prismaError('P2025'), messages)).not.toThrow()
    expect(toHttpError(prismaError('P2025'), messages)).toBeInstanceOf(Error)
  })
})

describe('toHttpError — what it deliberately does not disguise', () => {
  it('passes a unique violation through untouched when the model declares no conflict message', () => {
    // `conflict` is optional, so a model with no unique constraint to speak of leaves P2002
    // unmapped — it surfaces as a 500 rather than as a 409 with nothing to say
    const original = prismaError('P2002')

    expect(toHttpError(original, { notFound: 'Record not found' })).toBe(original)
  })

  it('passes an unrecognised Prisma code through untouched', () => {
    const original = prismaError('P2003')
    expect(toHttpError(original, messages)).toBe(original)
  })

  it('passes an ordinary Error through as the same instance', () => {
    const original = new Error('Connection reset')
    expect(toHttpError(original, messages)).toBe(original)
  })
})

describe('toHttpError — non-Error throws', () => {
  it('wraps a thrown string', () => {
    const result = toHttpError('boom', messages)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('boom')
  })

  it('wraps anything else, so a caller always gets an Error to throw', () => {
    expect(toHttpError(null, messages).message).toBe('null')
    expect(toHttpError(undefined, messages).message).toBe('undefined')
    expect(toHttpError({ code: 'P2002' }, messages).message).toBe('[object Object]')
  })
})
