import { createError } from 'h3'
import { isForeignKeyViolation, isMissingRow, isUniqueViolation } from '#server/db/prisma-errors'

interface IPrismaErrorMessages {
  conflict?: string
  inUse?: string
  notFound?: string
}

/**
 * A write carrying an `If-Match` version that matched no row, while the row is still there: someone
 * saved in between. `what` names the thing in the message the form shows.
 */
export function buildStaleWriteError(what: string): Error {
  return createError({
    statusCode: 412,
    statusMessage: `Someone changed this ${what} after you opened it. Close the form and open it again to see their changes.`,
  })
}

/**
 * A guarded write that found its row changed between the check and the write — the role a decision
 * rested on was edited meanwhile. Nothing was written; asking again decides on the new state.
 */
export function buildChangedMeanwhileError(what: string): Error {
  return createError({
    statusCode: 409,
    statusMessage: `This ${what} changed while your request was being handled. Reload and try again.`,
  })
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
