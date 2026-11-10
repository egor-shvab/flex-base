import { createError } from 'h3'
import { isMissingRow, isUniqueViolation } from '#server/db/prisma-errors'

interface IPrismaErrorMessages {
  conflict?: string
  notFound?: string
}

export function toHttpError(error: unknown, messages: IPrismaErrorMessages): Error {
  if (isUniqueViolation(error) && messages.conflict) {
    return createError({ statusCode: 409, statusMessage: messages.conflict })
  }

  if (isMissingRow(error) && messages.notFound) {
    return createError({ statusCode: 404, statusMessage: messages.notFound })
  }

  return error instanceof Error ? error : new Error(String(error))
}
