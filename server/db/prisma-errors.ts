import { Prisma } from '#server/generated/prisma/client'

/**
 * What a Prisma fault **is**, never what it should become. Classifying a constraint violation is a
 * persistence question; deciding that one answers 409 is a transport one, and it lives in
 * `#server/utils/http-errors`. Nothing under `server/db/` may import `h3` — the rule is in
 * `eslint.config.mjs`, because this file used to build the HTTP error itself.
 *
 * Predicates over `unknown` rather than over a narrowed type: every caller has a `catch` binding,
 * which TypeScript types as `unknown`, so narrowing here saves each of them the instanceof check.
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
