import { createError } from 'h3'
import { isForeignKeyViolation, isMissingRow, isUniqueViolation } from '#server/db/prisma-errors'

interface IPrismaErrorMessages {
  conflict?: string
  inUse?: string
  notFound?: string
}

export function toHttpError(error: unknown, messages: IPrismaErrorMessages): Error {
  if (isUniqueViolation(error) && messages.conflict) {
    return createError({ statusCode: 409, statusMessage: messages.conflict })
  }

  if (isForeignKeyViolation(error) && messages.inUse) {
    return createError({ statusCode: 409, statusMessage: messages.inUse })
  }

  if (isMissingRow(error) && messages.notFound) {
    return createError({ statusCode: 404, statusMessage: messages.notFound })
  }

  return error instanceof Error ? error : new Error(String(error))
}
