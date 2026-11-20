import { FULL_TABLE_ACCESS, NO_TABLE_ACCESS } from '#shared/constants/workspace'
import type { IRecord } from '#shared/types/record'
import type {
  ITableAccess,
  TFieldAccess,
  TFieldAccessOverride,
  TRecordScope,
} from '#shared/types/workspace'
import { hasPermission, type TPermissionHolder } from '#shared/utils/permissions'

/**
 * Whoever changes the schema sees every table: a table they could edit but not open would be
 * changed blind. Their record actions still come from their role.
 */
export function isTableVisibilityBypassed(actor: TPermissionHolder): boolean {
  return hasPermission(actor, 'TABLES_MANAGE')
}

/**
 * What the caller may do with one table's records: the owner everything, anyone else what the
 * role's row for the table grants — nothing without one.
 */
export function resolveTableAccess(
  actor: TPermissionHolder,
  tableRow: ITableAccess | null,
): ITableAccess {
  if (actor.isOwner) return FULL_TABLE_ACCESS

  const access = tableRow ?? NO_TABLE_ACCESS

  return isTableVisibilityBypassed(actor) ? { ...access, readScope: 'ALL' } : access
}

/**
 * What the caller may do with one field of a table they read. Whoever changes the schema sees and
 * edits every field, as they see every table; anyone else takes the role's row for the field, or
 * else edits it wherever they may write records at all.
 */
export function resolveFieldAccess(
  actor: TPermissionHolder,
  tableAccess: ITableAccess,
  fieldOverride: TFieldAccessOverride | null,
): TFieldAccess {
  if (isTableVisibilityBypassed(actor)) return 'EDIT'
  if (fieldOverride) return fieldOverride

  return tableAccess.canCreate || tableAccess.updateScope !== 'NONE' ? 'EDIT' : 'READ'
}

export function canReadRecords(access: ITableAccess): boolean {
  return access.readScope !== 'NONE'
}

/** A count over records the caller only partly reads would tell them how many others hold. */
export function canCountRecords(access: ITableAccess): boolean {
  return access.readScope === 'ALL'
}

/** A record with no author belongs to no one, so an `OWN` scope never reaches it. */
function isRecordInScope(scope: TRecordScope, authorId: string | null, userId: string): boolean {
  if (scope === 'OWN') return authorId !== null && authorId === userId
  return scope === 'ALL'
}

type TRecordAuthor = Pick<IRecord, 'createdById'>

export function canUpdateRecord(
  access: ITableAccess,
  record: TRecordAuthor,
  userId: string,
): boolean {
  return isRecordInScope(access.updateScope, record.createdById, userId)
}

export function canDeleteRecord(
  access: ITableAccess,
  record: TRecordAuthor,
  userId: string,
): boolean {
  return isRecordInScope(access.deleteScope, record.createdById, userId)
}
