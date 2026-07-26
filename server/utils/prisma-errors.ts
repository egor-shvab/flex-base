import { createError } from 'h3'
import { Prisma } from '#server/generated/prisma/client'

interface IPrismaErrorMessages {
  /** Message for a unique-constraint violation (P2002); omit when the model has none. */
  conflict?: string
  /** Message for an operation on a row that does not exist (P2025). */
  notFound: string
}

/**
 * Maps Prisma constraint errors onto HTTP errors; anything else is rethrown as-is
 * so unexpected failures still surface as a 500 instead of being disguised.
 */
export function toHttpError(error: unknown, messages: IPrismaErrorMessages): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002' && messages.conflict) {
      return createError({ statusCode: 409, statusMessage: messages.conflict })
    }
    if (error.code === 'P2025') {
      return createError({ statusCode: 404, statusMessage: messages.notFound })
    }
  }
  return error instanceof Error ? error : new Error(String(error))
}
