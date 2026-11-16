import { FULL_TABLE_ACCESS } from '#shared/constants/workspace'
import type { ITableAccess, IWorkspaceActor } from '#shared/types/workspace'
import { hasPermission } from '#shared/utils/permissions'

type TTableAccessHolder = Pick<IWorkspaceActor, 'isOwner' | 'permissions' | 'recordDefaults'>

/**
 * Whoever changes the schema sees every table: a table they could edit but not open would be
 * changed blind. Their record actions still come from their role.
 */
export function isTableVisibilityBypassed(actor: TTableAccessHolder): boolean {
  return hasPermission(actor, 'TABLES_MANAGE')
}

/**
 * What the caller may do with one table's records: the owner everything, anyone else the role's
 * row for the table — which replaces the role's defaults whole — or else those defaults.
 */
export function resolveTableAccess(
  actor: TTableAccessHolder,
  tableOverride: ITableAccess | null,
): ITableAccess {
  if (actor.isOwner) return FULL_TABLE_ACCESS

  const access = tableOverride ?? actor.recordDefaults

  return isTableVisibilityBypassed(actor) ? { ...access, readScope: 'ALL' } : access
}

export function canReadRecords(access: ITableAccess): boolean {
  return access.readScope !== 'NONE'
}
