import type { ITable } from '#shared/types/table'

/** PostgreSQL `Int`: past it Prisma throws (a 500) rather than simply missing (a 404). */
const MAX_ADDRESS_NUMBER = 2_147_483_647

/** `parseInt` is deliberately unused: it reads `12abc` as `12`. */
const ADDRESS_NUMBER = /^\d+$/

export function parseAddressNumber(raw: string): number {
  if (!ADDRESS_NUMBER.test(raw)) return 0

  const value = Number(raw)
  return value >= 1 && value <= MAX_ADDRESS_NUMBER ? value : 0
}

export function parseTableAddress(raw: string): number {
  const [number = ''] = raw.split('-', 1)
  return parseAddressNumber(number)
}

export function toTableAddress(table: Pick<ITable, 'number'>): string {
  return String(table.number)
}
