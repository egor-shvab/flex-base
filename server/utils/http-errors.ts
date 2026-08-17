import { createError } from 'h3'
import { isMissingRow, isUniqueViolation } from '#server/db/prisma-errors'

interface IPrismaErrorMessages {
  /** Message for a unique-constraint violation (P2002); omit when the model has none. */
  conflict?: string
  /** Message for an operation on a row that does not exist (P2025). */
  notFound: string
}

/**
 * Where a persistence fault becomes a response. `db/prisma-errors.ts` says what a Prisma error
 * **is**; this says what the caller answers with, and it is the one place the mapping is written —
 * all three services share it, so a constraint cannot mean 409 in one and 500 in another.
 *
 * Three properties are deliberate:
 *
 * - **Anything unrecognised is returned untouched**, so an unexpected failure still surfaces as a
 *   500 rather than being disguised as a tidy 4xx.
 * - **`conflict` is optional.** A model with no unique constraint worth naming leaves P2002
 *   unmapped rather than answering 409 with nothing to say.
 * - **It returns rather than throws**, so every call site keeps its own `throw` and the control
 *   flow reads the same as any other guard.
 *
 * The other half of this app's status policy is not here and should not be moved here: a rule's
 * message *is* the rule ("Field type cannot be changed"), so it belongs beside the rule that
 * raises it. What is shared is the mapping, not the wording (`docs/decisions.md`).
 */
export function toHttpError(error: unknown, messages: IPrismaErrorMessages): Error {
  if (isUniqueViolation(error) && messages.conflict) {
    return createError({ statusCode: 409, statusMessage: messages.conflict })
  }

  if (isMissingRow(error)) {
    return createError({ statusCode: 404, statusMessage: messages.notFound })
  }

  return error instanceof Error ? error : new Error(String(error))
}
