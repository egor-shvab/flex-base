import { createError } from 'h3'
import {
  buildRoleFieldAccessSelect,
  FIELD_ORDER,
  fieldSelect,
  toFieldOverride,
  toSharedField,
  type TFieldRow,
} from '#server/db/fields'
import { prisma } from '#server/db/prisma'
import {
  buildRoleTableAccessSelect,
  buildTableAddressWhere,
  tableSelect,
  toSharedTable,
  toTableAccess,
} from '#server/db/tables'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'
import type { IRecordActor } from '#server/db/records'
import type { IAuthUser } from '#shared/types/auth'
import type {
  ITableAccess,
  IWorkspaceMembership,
  TFieldAccess,
  TFieldAccessOverride,
  TRecordAction,
  TRecordScope,
} from '#shared/types/workspace'
import { parseTableAddress } from '#shared/utils/address'
import { hasRecordAction } from '#shared/utils/permissions'
import { canLabelRecords } from '#shared/utils/record-label'
import {
  canReadRecords,
  isTableVisibilityBypassed,
  resolveFieldAccess,
  resolveTableAccess,
} from '#shared/utils/table-access'
import type { TFieldInput } from '#shared/validation/field'

/** Also for a table the caller may not read: the same 404 as one that does not exist. */
export function buildTableNotFoundError() {
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

/** A table's fields as the caller sees them; a hidden one is absent, as if it did not exist. */
export interface IFieldScope {
  /** Visible fields, a link's label dropped where the caller may not read it whole (`toFieldView`). */
  fields: IField[]
  /** The fields a write may set: any other keeps its stored value. */
  editableFields: IField[]
  targetScopes: ReadonlyMap<string, TRecordScope>
}

export interface IWorkspaceTableFields extends ITableScope, IFieldScope {
  tableId: string
}

/** A table the caller's role may not read is the same 404 as one that does not exist. */
function requireReadableAccess(
  membership: IWorkspaceMembership,
  rows: readonly ITableAccess[],
): ITableAccess {
  const access = resolveTableAccess(membership, toTableAccess(rows))

  if (!canReadRecords(access)) throw buildTableNotFoundError()

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

  if (!row) throw buildTableNotFoundError()

  return {
    table: toSharedTable(row),
    access: requireReadableAccess(membership, row.roleAccess),
  }
}

/** How the caller reads a table its fields link to; `NONE` for one they may not read at all. */
interface IRelationTargetView {
  readScope: TRecordScope
  hiddenKeys: ReadonlySet<string>
}

/**
 * How the caller reads each table the fields link to, in one query for all of them. Empty for
 * whoever sees every table and field, for whom nothing narrows a link.
 */
async function listRelationTargetViews(
  membership: IWorkspaceMembership,
  fields: readonly IField[],
): Promise<Map<string, IRelationTargetView>> {
  const targetIds = new Set<string>()
  const labelKeys = new Set<string>()

  for (const field of fields) {
    const targetTableId = field.type === 'RELATION' ? field.options?.targetTableId : undefined
    if (targetTableId === undefined) continue
    targetIds.add(targetTableId)
    if (field.options?.labelFieldKey !== undefined) labelKeys.add(field.options.labelFieldKey)
  }

  if (targetIds.size === 0 || isTableVisibilityBypassed(membership)) return new Map()

  const roleId = membership.role.id
  const targets = await prisma.table.findMany({
    where: { workspaceId: membership.workspace.id, id: { in: [...targetIds] } },
    select: {
      id: true,
      ...buildRoleTableAccessSelect(roleId),
      fields: {
        where: { key: { in: [...labelKeys] } },
        select: { key: true, ...buildRoleFieldAccessSelect(roleId) },
      },
    },
  })

  const views = new Map<string, IRelationTargetView>()

  for (const target of targets) {
    const access = resolveTableAccess(membership, toTableAccess(target.roleAccess))
    const hiddenKeys = new Set(
      target.fields
        .filter(
          (field) =>
            resolveFieldAccess(membership, access, toFieldOverride(field.roleAccess)) === 'HIDDEN',
        )
        .map((field) => field.key),
    )
    views.set(target.id, { readScope: access.readScope, hiddenKeys })
  }

  return views
}

/**
 * A link as the caller sees it: `null` where they may not read its table, which hides the field;
 * without its label where they may not see that field, or read only some of the table — a label
 * of a record out of their sight, or the order such labels sort in, would show what they cannot.
 */
function toFieldView(
  field: IField,
  views: ReadonlyMap<string, IRelationTargetView>,
  isBypassed: boolean,
): IField | null {
  const targetTableId = field.type === 'RELATION' ? field.options?.targetTableId : undefined
  if (targetTableId === undefined || isBypassed) return field

  const view = views.get(targetTableId)
  if (view === undefined || view.readScope === 'NONE') return null

  const labelFieldKey = field.options?.labelFieldKey
  if (labelFieldKey === undefined) return field
  if (view.readScope === 'ALL' && !view.hiddenKeys.has(labelFieldKey)) return field

  const options = { ...field.options }
  delete options.labelFieldKey
  return { ...field, options }
}

type TFieldRowWithAccess = TFieldRow & { roleAccess: { access: TFieldAccessOverride }[] }

async function resolveFieldScope(
  membership: IWorkspaceMembership,
  access: ITableAccess,
  rows: readonly TFieldRowWithAccess[],
): Promise<IFieldScope> {
  const accessByField = new Map<string, TFieldAccess>()
  for (const row of rows) {
    accessByField.set(
      row.id,
      resolveFieldAccess(membership, access, toFieldOverride(row.roleAccess)),
    )
  }

  const shown = rows.filter((row) => accessByField.get(row.id) !== 'HIDDEN').map(toSharedField)
  const views = await listRelationTargetViews(membership, shown)
  const isBypassed = isTableVisibilityBypassed(membership)

  const fields = shown.flatMap((field) => toFieldView(field, views, isBypassed) ?? [])
  const targetScopes = new Map(
    [...views].map(([tableId, view]): [string, TRecordScope] => [tableId, view.readScope]),
  )

  return {
    fields,
    editableFields: fields.filter((field) => accessByField.get(field.id) === 'EDIT'),
    targetScopes,
  }
}

/** The one lookup both helpers below share; a few table columns more than one needs cost nothing. */
async function requireTableWithFieldScope(membership: IWorkspaceMembership, address: string) {
  const roleId = membership.role.id
  const row = await prisma.table.findUnique({
    where: buildTableAddressWhere(membership.workspace.id, address),
    select: {
      ...tableSelect,
      ...buildRoleTableAccessSelect(roleId),
      fields: {
        orderBy: FIELD_ORDER,
        select: { ...fieldSelect, ...buildRoleFieldAccessSelect(roleId) },
      },
    },
  })

  if (!row) throw buildTableNotFoundError()

  const access = requireReadableAccess(membership, row.roleAccess)
  return { row, access, ...(await resolveFieldScope(membership, access, row.fields)) }
}

export async function requireWorkspaceTableFields(
  membership: IWorkspaceMembership,
  address: string,
): Promise<IWorkspaceTableFields> {
  const { row, ...scope } = await requireTableWithFieldScope(membership, address)
  return { tableId: row.id, ...scope }
}

export async function requireWorkspaceTableWithFields(
  membership: IWorkspaceMembership,
  address: string,
): Promise<IWorkspaceTableFields & { table: ITable }> {
  const { row, ...scope } = await requireTableWithFieldScope(membership, address)
  return { table: toSharedTable(row), tableId: row.id, ...scope }
}

/** The caller as `RecordService` and `RelationService` take them. */
export function toRecordActor(
  context: { user: IAuthUser } & ITableScope & Pick<IFieldScope, 'targetScopes'>,
): IRecordActor {
  return { userId: context.user.id, access: context.access, targetScopes: context.targetScopes }
}

export async function requireFieldTarget(
  membership: IWorkspaceMembership,
  input: TFieldInput,
): Promise<void> {
  if (input.type !== 'RELATION') return

  // A cuid only: an all-digit target would resolve as a table number and then be stored
  // verbatim in `options.targetTableId`, where every reader expects an id
  if (parseTableAddress(input.targetTableId) !== 0) throw buildTableNotFoundError()

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
