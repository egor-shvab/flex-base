import type {
  IAccessTable,
  IRoleOverrides,
  ITableAccess,
  IWorkspaceActor,
  TFieldAccess,
} from '#shared/types/workspace'
import {
  canReadRecords,
  isTableVisibilityBypassed,
  resolveFieldAccess,
  resolveTableAccess,
} from '#shared/utils/table-access'
import type { TRoleAccessInput } from '#shared/validation/role-access'

/** The role being edited, as `resolveTableAccess` reads a holder: never the owner. */
function toSubjectHolder(input: TRoleAccessInput, permissions: IWorkspaceActor['permissions']) {
  return { isOwner: false, permissions, recordDefaults: input.recordDefaults }
}

function findOverrideIn(rows: IRoleOverrides['tables'], tableId: string): ITableAccess | null {
  const row = rows.find((candidate) => candidate.tableId === tableId)
  if (!row) return null

  const { tableId: _tableId, ...access } = row
  return access
}

export function findTableOverride(input: TRoleAccessInput, tableId: string): ITableAccess | null {
  return findOverrideIn(input.tables, tableId)
}

/** `null` returns the table to the role's defaults. */
export function applyTableOverride(
  input: TRoleAccessInput,
  tableId: string,
  access: ITableAccess | null,
): TRoleAccessInput {
  const others = input.tables.filter((row) => row.tableId !== tableId)
  return { ...input, tables: access ? [...others, { tableId, ...access }] : others }
}

/** `EDIT` is no row: the field follows what the role may do with the table's records. */
export function findFieldAccess(input: TRoleAccessInput, fieldId: string): TFieldAccess {
  return input.fields.find((row) => row.fieldId === fieldId)?.access ?? 'EDIT'
}

export function applyFieldAccess(
  input: TRoleAccessInput,
  fieldId: string,
  access: TFieldAccess,
): TRoleAccessInput {
  const others = input.fields.filter((row) => row.fieldId !== fieldId)
  return { ...input, fields: access === 'EDIT' ? others : [...others, { fieldId, access }] }
}

/** What the role does with one table's records: its row there, or its defaults. */
export function resolveSubjectTableAccess(
  input: TRoleAccessInput,
  permissions: IWorkspaceActor['permissions'],
  tableId: string,
): ITableAccess {
  return resolveTableAccess(toSubjectHolder(input, permissions), findTableOverride(input, tableId))
}

/**
 * What the server accepts: a field row on a table the role does not read narrows nothing and is
 * refused, so such rows are dropped as the table closes rather than kept for a later reopening.
 */
export function toRoleAccessPayload(
  input: TRoleAccessInput,
  permissions: IWorkspaceActor['permissions'],
  tables: readonly IAccessTable[],
): TRoleAccessInput {
  const unreadFieldIds = new Set(
    tables
      .filter((table) => !canReadRecords(resolveSubjectTableAccess(input, permissions, table.id)))
      .flatMap((table) => table.fields.map((field) => field.id)),
  )

  return { ...input, fields: input.fields.filter((row) => !unreadFieldIds.has(row.fieldId)) }
}

/** How far the editor may grant: their own effective access, table by table and field by field. */
export interface IAccessLimits {
  defaults: ITableAccess
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
    resolveTableAccess(holder, findOverrideIn(overrides.tables, tableId))

  return {
    defaults: actor.recordDefaults,
    tableAccess,
    fieldAccess: (tableId, fieldId) =>
      resolveFieldAccess(
        holder,
        tableAccess(tableId),
        overrides.fields.find((row) => row.fieldId === fieldId)?.access ?? null,
      ),
  }
}

/** A role that manages tables sees every table and field: only its record actions narrow. */
export function isRoleVisibilityBypassed(
  input: TRoleAccessInput,
  permissions: IWorkspaceActor['permissions'],
): boolean {
  return isTableVisibilityBypassed(toSubjectHolder(input, permissions))
}
