import { createError } from 'h3'
import { isMissingRow, isUniqueViolation } from '#server/db/prisma-errors'

interface IPrismaErrorMessages {
  /** Message for a unique-constraint violation (P2002); omit when the model has none. */
  conflict?: string
  /** Message for an operation on a row that does not exist (P2025); omit when none can occur. */
  notFound?: string
}

/**
 * Where a persistence fault becomes a response. `db/prisma-errors.ts` says what a Prisma error
 * **is**; this says what the caller answers with, in one place, so a constraint cannot mean 409
 * in one service and 500 in another.
 *
 * Three properties are deliberate:
 *
 * - **Anything unrecognised is returned untouched**, so an unexpected failure still surfaces as
 *   a 500 rather than being disguised as a tidy 4xx.
 * - **Both messages are optional, and an absent one means "do not map this"** — better than a
 *   409 with nothing to say, or a 404 message that can never be shown.
 * - **It returns rather than throws**, so every call site keeps its own `throw`.
 *
 * The other half of the status policy stays where it is: a rule's message *is* the rule, so it
 * belongs beside the rule that raises it. What is shared is the mapping (`docs/decisions.md`).
 */
export function toHttpError(error: unknown, messages: IPrismaErrorMessages): Error {
  if (isUniqueViolation(error) && messages.conflict) {
    return createError({ statusCode: 409, statusMessage: messages.conflict })
  }

  if (isMissingRow(error) && messages.notFound) {
    return createError({ statusCode: 404, statusMessage: messages.notFound })
  }

  return error instanceof Error ? error : new Error(String(error))
}
