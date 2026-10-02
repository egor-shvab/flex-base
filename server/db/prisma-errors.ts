import { Prisma } from '#server/generated/prisma/client'

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, 'P2002')
}

export function isMissingRow(error: unknown): boolean {
  return hasCode(error, 'P2025')
}
