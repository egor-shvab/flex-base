import { Prisma } from '#server/generated/prisma/client'

/**
 * What a Prisma fault **is**, never what it should become: classifying a constraint violation is
 * a persistence question, deciding it answers 409 a transport one (`#server/utils/http-errors`).
 * Nothing under `server/db/` may import `h3`, enforced in `eslint.config.mjs`.
 *
 * Predicates over `unknown`, since every caller has a `catch` binding TypeScript types that way.
 */
function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

/** P2002 — a unique constraint was violated. Which one is not knowable from the error alone. */
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, 'P2002')
}

/** P2025 — an update or delete matched no row. */
export function isMissingRow(error: unknown): boolean {
  return hasCode(error, 'P2025')
}
