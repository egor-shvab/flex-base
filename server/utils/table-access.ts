import { createError } from 'h3'
import { FIELD_ORDER, fieldSelect, toSharedField } from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import {
  buildRoleTableAccessSelect,
  buildTableAddressWhere,
  tableSelect,
  toSharedTable,
  toTableOverride,
} from '#server/db/tables'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'
import type { ITableAccess, IWorkspaceMembership, TRecordAction } from '#shared/types/workspace'
import { parseTableAddress } from '#shared/utils/address'
import { hasRecordAction } from '#shared/utils/permissions'
import { canLabelRecords } from '#shared/utils/record-label'
import { canReadRecords, resolveTableAccess } from '#shared/utils/table-access'
import type { TFieldInput } from '#shared/validation/field'

function tableNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Table not found' })
}

const DENIED_RECORD_ACTIONS: Record<TRecordAction, string> = {
  create: 'add records to this table',
  update: 'edit records in this table',
  delete: 'delete records in this table',
}

/** What every table lookup proves besides the table: what the caller may do with its records. */
export interface ITableScope {
  access: ITableAccess
}

export interface IWorkspaceTableFields extends ITableScope {
  tableId: string
  fields: IField[]
}

/** A table the caller's role may not read is the same 404 as one that does not exist. */
function requireReadableAccess(
  membership: IWorkspaceMembership,
  overrides: readonly ITableAccess[],
): ITableAccess {
  const access = resolveTableAccess(membership, toTableOverride(overrides))

  if (!canReadRecords(access)) throw tableNotFound()

  return access
}

export function assertRecordAction(access: ITableAccess, action: TRecordAction) {
  if (hasRecordAction(access, action)) return

  throw createError({
    statusCode: 403,
    statusMessage: `You don't have permission to ${DENIED_RECORD_ACTIONS[action]}`,
  })
}

export async function requireWorkspaceTable(
  membership: IWorkspaceMembership,
  address: string,
): Promise<ITableScope & { table: ITable }> {
  const row = await prisma.table.findUnique({
    where: buildTableAddressWhere(membership.workspace.id, address),
    select: { ...tableSelect, ...buildRoleTableAccessSelect(membership.role.id) },
  })

  if (!row) throw tableNotFound()

  return {
    table: toSharedTable(row),
    access: requireReadableAccess(membership, row.roleAccess),
  }
}

/** The one lookup both helpers below share; a few table columns more than one needs cost nothing. */
async function requireTableWithFieldRows(membership: IWorkspaceMembership, address: string) {
  const row = await prisma.table.findUnique({
    where: buildTableAddressWhere(membership.workspace.id, address),
    select: {
      ...tableSelect,
      ...buildRoleTableAccessSelect(membership.role.id),
      fields: { orderBy: FIELD_ORDER, select: fieldSelect },
    },
  })

  if (!row) throw tableNotFound()

  return { row, access: requireReadableAccess(membership, row.roleAccess) }
}

export async function requireWorkspaceTableFields(
  membership: IWorkspaceMembership,
  address: string,
): Promise<IWorkspaceTableFields> {
  const { row, access } = await requireTableWithFieldRows(membership, address)
  return { tableId: row.id, fields: row.fields.map(toSharedField), access }
}

export async function requireWorkspaceTableWithFields(
  membership: IWorkspaceMembership,
  address: string,
) {
  const { row, access } = await requireTableWithFieldRows(membership, address)
  return { table: toSharedTable(row), fields: row.fields.map(toSharedField), access }
}

export async function requireFieldTarget(
  membership: IWorkspaceMembership,
  input: TFieldInput,
): Promise<void> {
  if (input.type !== 'RELATION') return

  // A cuid only: an all-digit target would resolve as a table number and then be stored
  // verbatim in `options.targetTableId`, where every reader expects an id
  if (parseTableAddress(input.targetTableId) !== 0) throw tableNotFound()

  const { fields } = await requireWorkspaceTableFields(membership, input.targetTableId)

  const labelField = fields.find((field) => field.key === input.labelFieldKey)

  if (labelField === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown field to show for the link' })
  }
  if (!canLabelRecords(labelField)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'That field cannot be shown for a link: choose a single-value field',
    })
  }
}

/** Checked after the record action, so a member who may not write learns nothing about the table. */
export function assertTableHasFields(fields: readonly IField[]) {
  if (fields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'This table has no fields yet' })
  }
}
