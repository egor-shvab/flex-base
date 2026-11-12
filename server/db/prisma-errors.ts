import { Prisma } from '#server/generated/prisma/client'

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, 'P2002')
}

/**
 * Under `@prisma/adapter-pg` the columns arrive as `driverAdapterError.cause.constraint.fields`
 * rather than as `meta.target`, quoted only where PostgreSQL would need it: `email`, `"publicId"`.
 */
export function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (!isUniqueViolation(error)) return false

  const meta = (error as Prisma.PrismaClientKnownRequestError).meta as
    { driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined
  const fields = meta?.driverAdapterError?.cause?.constraint?.fields

  return (
    Array.isArray(fields) && fields.some((field) => field === column || field === `"${column}"`)
  )
}

export function isMissingRow(error: unknown): boolean {
  return hasCode(error, 'P2025')
}
