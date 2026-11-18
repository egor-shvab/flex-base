import { FIELD_ACCESS_LEVELS } from '#shared/constants/workspace'
import type {
  IAccessTable,
  IPermissionSet,
  IRoleGrants,
  ITableAccess,
  TFieldAccess,
  TFieldAccessOverride,
} from '#shared/types/workspace'
import { isPermissionSubset, isTableAccessWithin } from '#shared/utils/permissions'
import { canReadRecords, resolveFieldAccess, resolveTableAccess } from '#shared/utils/table-access'

/** A role's grants as held by someone: the owner holds everything, whatever the role says. */
export interface IAccessHolder extends IRoleGrants {
  isOwner: boolean
}

/**
 * A role as a member holding it meets it — never as the owner, whom no role binds. What
 * `resolveTableAccess`, `resolveFieldAccess` and `isAccessWithin` take for a role on its own.
 */
export function toRoleHolder<TRole extends IPermissionSet>(
  role: TRole,
): TRole & { isOwner: false } {
  return { ...role, isOwner: false }
}

/** A role's row for one table, without its key; `null` where the table is closed to the role. */
export function findTableAccess(
  grants: Pick<IRoleGrants, 'tables'>,
  tableId: string,
): ITableAccess | null {
  const row = grants.tables.find((candidate) => candidate.tableId === tableId)
  if (!row) return null

  const { tableId: _tableId, ...access } = row
  return access
}

/** A role's row for one field, if it narrows it. */
export function findFieldOverride(
  grants: Pick<IRoleGrants, 'fields'>,
  fieldId: string,
): TFieldAccessOverride | null {
  return grants.fields.find((row) => row.fieldId === fieldId)?.access ?? null
}

function isFieldAccessWithin(access: TFieldAccess, of: TFieldAccess): boolean {
  return FIELD_ACCESS_LEVELS.indexOf(access) <= FIELD_ACCESS_LEVELS.indexOf(of)
}

/**
 * Whether `subject` grants nothing beyond `holder` — its permissions, and its effective access to
 * each table and each field of `tables`, as
 * `resolveTableAccess` and `resolveFieldAccess` decide them for anyone holding it. A field of a
 * table the subject cannot read grants nothing, so it is not compared.
 */
export function isAccessWithin(
  subject: IRoleGrants,
  holder: IAccessHolder,
  tables: readonly IAccessTable[],
): boolean {
  if (holder.isOwner) return true
  if (!isPermissionSubset(subject.permissions, holder.permissions)) return false

  const subjectHolder = toRoleHolder(subject)

  return tables.every((table) => {
    const subjectAccess = resolveTableAccess(subjectHolder, findTableAccess(subject, table.id))
    const holderAccess = resolveTableAccess(holder, findTableAccess(holder, table.id))

    if (!isTableAccessWithin(subjectAccess, holderAccess)) return false
    if (!canReadRecords(subjectAccess)) return true

    return table.fields.every((field) =>
      isFieldAccessWithin(
        resolveFieldAccess(subjectHolder, subjectAccess, findFieldOverride(subject, field.id)),
        resolveFieldAccess(holder, holderAccess, findFieldOverride(holder, field.id)),
      ),
    )
  })
}
