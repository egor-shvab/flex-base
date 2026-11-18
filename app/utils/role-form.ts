import { NO_TABLE_ACCESS } from '#shared/constants/workspace'
import type {
  IAccessTable,
  IRoleOverrides,
  ITableAccess,
  IWorkspaceActor,
  TFieldAccess,
} from '#shared/types/workspace'
import { isTableAccessWithin } from '#shared/utils/permissions'
import {
  canReadRecords,
  isTableVisibilityBypassed,
  resolveFieldAccess,
  resolveTableAccess,
} from '#shared/utils/table-access'
import type { TRoleInput } from '#shared/validation/workspace'

type TRoleGrantsInput = Pick<TRoleInput, 'permissions' | 'tables'>

/** The role being edited, as `resolveTableAccess` reads a holder: never the owner. */
function toSubjectHolder(role: TRoleGrantsInput) {
  return { isOwner: false, permissions: role.permissions }
}

export function findTableOverride(
  rows: IRoleOverrides['tables'],
  tableId: string,
): ITableAccess | null {
  const row = rows.find((candidate) => candidate.tableId === tableId)
  if (!row) return null

  const { tableId: _tableId, ...access } = row
  return access
}

/** Access that grants nothing is no row: a table without one is closed to the role. */
export function applyTableOverride(
  rows: IRoleOverrides['tables'],
  tableId: string,
  access: ITableAccess,
): IRoleOverrides['tables'] {
  const others = rows.filter((row) => row.tableId !== tableId)
  return isTableAccessWithin(access, NO_TABLE_ACCESS) ? others : [...others, { tableId, ...access }]
}

/** `EDIT` is no row: the field follows what the role may do with the table's records. */
export function findFieldAccess(rows: IRoleOverrides['fields'], fieldId: string): TFieldAccess {
  return rows.find((row) => row.fieldId === fieldId)?.access ?? 'EDIT'
}

export function applyFieldAccess(
  rows: IRoleOverrides['fields'],
  fieldId: string,
  access: TFieldAccess,
): IRoleOverrides['fields'] {
  const others = rows.filter((row) => row.fieldId !== fieldId)
  return access === 'EDIT' ? others : [...others, { fieldId, access }]
}

/** What the role does with one table's records: its row there, or nothing. */
export function resolveSubjectTableAccess(role: TRoleGrantsInput, tableId: string): ITableAccess {
  return resolveTableAccess(toSubjectHolder(role), findTableOverride(role.tables, tableId))
}

/** A role that manages tables sees every table and field: only its record actions narrow. */
export function isRoleVisibilityBypassed(role: TRoleGrantsInput): boolean {
  return isTableVisibilityBypassed(toSubjectHolder(role))
}

/**
 * What the server accepts: a field row on a table the role does not read narrows nothing and is
 * refused, so such rows are dropped as the table closes rather than kept for a later reopening.
 */
export function toRolePayload(role: TRoleInput, tables: readonly IAccessTable[]): TRoleInput {
  const unreadFieldIds = new Set(
    tables
      .filter((table) => !canReadRecords(resolveSubjectTableAccess(role, table.id)))
      .flatMap((table) => table.fields.map((field) => field.id)),
  )

  return { ...role, fields: role.fields.filter((row) => !unreadFieldIds.has(row.fieldId)) }
}

/** A table's fields line: how many, and how many the role has narrowed. */
export function summariseFieldAccess(table: IAccessTable, rows: IRoleOverrides['fields']): string {
  const fieldIds = new Set(table.fields.map((field) => field.id))
  const narrowed = rows.filter((row) => fieldIds.has(row.fieldId))
  const hiddenCount = narrowed.filter((row) => row.access === 'HIDDEN').length
  const readOnlyCount = narrowed.length - hiddenCount
  const parts = [
    hiddenCount > 0 ? `${hiddenCount} hidden` : '',
    readOnlyCount > 0 ? `${readOnlyCount} read only` : '',
  ].filter(Boolean)
  const count = `${table.fields.length} ${table.fields.length === 1 ? 'field' : 'fields'}`

  return [count, ...(parts.length > 0 ? parts : ['all editable'])].join(' · ')
}

/** How far the editor may grant: their own effective access, table by table and field by field. */
export interface IAccessLimits {
  tableAccess: (tableId: string) => ITableAccess
  fieldAccess: (tableId: string, fieldId: string) => TFieldAccess
}

/** `overrides` are the actor's own role's rows; the owner has none that count. */
export function buildAccessLimits(
  actor: IWorkspaceActor,
  overrides: IRoleOverrides,
): IAccessLimits {
  const holder = { ...actor, ...overrides }
  const tableAccess = (tableId: string) =>
    resolveTableAccess(holder, findTableOverride(overrides.tables, tableId))

  return {
    tableAccess,
    fieldAccess: (tableId, fieldId) =>
      resolveFieldAccess(
        holder,
        tableAccess(tableId),
        overrides.fields.find((row) => row.fieldId === fieldId)?.access ?? null,
      ),
  }
}
