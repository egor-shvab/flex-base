import type { Prisma } from '#server/generated/prisma/client'
import type { ITable, ITableListItem } from '#shared/types/table'
import type { ITableAccess, IWorkspaceMembership } from '#shared/types/workspace'
import { parseTableAddress } from '#shared/utils/address'
import { isTableVisibilityBypassed } from '#shared/utils/table-access'

export function buildTableAddressWhere(
  workspaceId: string,
  address: string,
): Prisma.TableWhereUniqueInput {
  const number = parseTableAddress(address)

  return number === 0
    ? { id: address, workspaceId }
    : { workspaceId_number: { workspaceId, number } }
}

export const tableSelect = {
  id: true,
  number: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TableSelect

/** Records are read from the kept count, never `_count`: that is a `COUNT(*)` per table per load. */
export const tableListSelect = {
  ...tableSelect,
  recordCount: true,
  _count: { select: { fields: true } },
} satisfies Prisma.TableSelect

const tableAccessSelect = {
  readScope: true,
  canCreate: true,
  updateScope: true,
  deleteScope: true,
} satisfies Prisma.RoleTableAccessSelect

/** The caller's role's row for the table, if it has one: at most one, by the primary key. */
export function buildRoleTableAccessSelect(roleId: string) {
  return {
    roleAccess: { where: { roleId }, select: tableAccessSelect },
  } satisfies Prisma.TableSelect
}

export function toTableOverride(rows: readonly ITableAccess[]): ITableAccess | null {
  return rows[0] ?? null
}

/**
 * The tables the caller's role may open, decided in the query as `resolveTableAccess` decides one
 * table: a row of the role's for the table wins, the role's default read applies otherwise.
 */
export function buildReadableTablesWhere(membership: IWorkspaceMembership): Prisma.TableWhereInput {
  if (isTableVisibilityBypassed(membership)) return {}

  const roleId = membership.role.id

  return membership.recordDefaults.readScope === 'NONE'
    ? { roleAccess: { some: { roleId, readScope: { not: 'NONE' } } } }
    : { roleAccess: { none: { roleId, readScope: 'NONE' } } }
}

export type TTableRow = Prisma.TableGetPayload<{ select: typeof tableSelect }>
export type TTableListRow = Prisma.TableGetPayload<{ select: typeof tableListSelect }>

export function toSharedTable(row: TTableRow): ITable {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSharedTableListItem(row: TTableListRow): ITableListItem {
  return {
    ...toSharedTable(row),
    _count: { fields: row._count.fields, records: row.recordCount },
  }
}
