import { createError } from 'h3'
import type { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { ACCESS_TABLE_ORDER, accessTableSelect, toAccessTable } from '#server/db/tables'
import {
  buildRoleWhere,
  roleGrantsSelect,
  roleSelect,
  toRoleGrants,
  toRoleOverrides,
  toSharedRole,
  type TRoleGrantsRow,
  type TRoleRow,
} from '#server/db/workspaces'
import { isForeignKeyViolation, isMissingRow } from '#server/db/prisma-errors'
import {
  buildChangedMeanwhileError,
  buildStaleWriteError,
  toHttpError,
} from '#server/utils/http-errors'
import type { IRoleDetailResponse } from '#shared/types/api'
import type {
  IAccessTable,
  IRoleGrants,
  IWorkspaceMembership,
  IWorkspaceRole,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { hasPermission } from '#shared/utils/permissions'
import { isAccessWithin } from '#shared/utils/role-access'
import { canReadRecords, resolveFieldAccess, resolveTableAccess } from '#shared/utils/table-access'
import type { TRoleInput } from '#shared/validation/workspace'

export const MAX_WORKSPACE_ROLES = 20

const roleErrors = {
  conflict: 'A role with this name already exists',
  notFound: 'Role not found',
}

/** Whoever may assign, edit or delete roles, or manage those who hold them, needs the comparison. */
const ROLE_REACH_PERMISSIONS: readonly TWorkspacePermission[] = [
  'ROLES_MANAGE',
  'MEMBERS_MANAGE',
  'MEMBERS_INVITE',
]

function buildEscalationError() {
  return createError({
    statusCode: 403,
    statusMessage: 'You can only manage roles within your own permissions',
  })
}

function buildRoleNotFoundError() {
  return createError({ statusCode: 404, statusMessage: roleErrors.notFound })
}

/**
 * The workspace's tables and fields, and the grants of the roles asked for — the actor's among them
 * — in two queries: what every anti-escalation decision reads.
 */
interface IAccessGround {
  tables: IAccessTable[]
  rolesById: Map<string, TRoleGrantsRow>
}

async function loadAccessGround(workspaceId: string, roleIds: string[]): Promise<IAccessGround> {
  const [tables, roles] = await Promise.all([
    prisma.table.findMany({
      where: { workspaceId },
      orderBy: ACCESS_TABLE_ORDER,
      select: accessTableSelect,
    }),
    prisma.workspaceRole.findMany({
      where: { workspaceId, id: { in: [...new Set(roleIds)] } },
      select: roleGrantsSelect,
    }),
  ])

  return {
    tables: tables.map(toAccessTable),
    rolesById: new Map(roles.map((role) => [role.id, role])),
  }
}

function requireGroundRole(ground: IAccessGround, roleId: string): TRoleGrantsRow {
  const role = ground.rolesById.get(roleId)
  if (!role) throw buildRoleNotFoundError()
  return role
}

/** Whether `subject` grants nothing beyond the actor, over the ground's tables and fields. */
function isWithinActor(
  ground: IAccessGround,
  actor: IWorkspaceMembership,
  subject: IRoleGrants,
): boolean {
  if (actor.isOwner) return true

  const actorRole = ground.rolesById.get(actor.role.id)
  if (!actorRole) return false

  return isAccessWithin(subject, { isOwner: false, ...toRoleGrants(actorRole) }, ground.tables)
}

/**
 * Each role with whether it is within the caller. Only a caller who can act on roles or their
 * holders needs the comparison; for anyone else it is false, and nothing more is read.
 */
async function listRoles(actor: IWorkspaceMembership): Promise<IWorkspaceRole[]> {
  const workspaceId = actor.workspace.id
  // The default roles share one `createdAt`: the name keeps their order stable
  const rows = await prisma.workspaceRole.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    select: roleSelect,
  })

  if (!ROLE_REACH_PERMISSIONS.some((permission) => hasPermission(actor, permission))) {
    return rows.map((row) => toSharedRole(row, false))
  }

  const ground = await loadAccessGround(workspaceId, [actor.role.id, ...rows.map((row) => row.id)])

  return rows.map((row) => {
    const grants = ground.rolesById.get(row.id)
    return toSharedRole(
      row,
      grants !== undefined && isWithinActor(ground, actor, toRoleGrants(grants)),
    )
  })
}

/**
 * Whether a role of the actor's workspace is within them, and the version that answer holds for —
 * which a write resting on it repeats. 404 for a role that is not there.
 */
async function getRoleReach(
  actor: IWorkspaceMembership,
  roleId: string,
): Promise<{ isWithinActor: boolean; updatedAt: Date }> {
  const ground = await loadAccessGround(actor.workspace.id, [actor.role.id, roleId])
  const role = requireGroundRole(ground, roleId)

  return {
    isWithinActor: isWithinActor(ground, actor, toRoleGrants(role)),
    updatedAt: role.updatedAt,
  }
}

/** A role of the actor's workspace they may hand out: to a member, or in an invitation. */
async function requireAssignableRole(actor: IWorkspaceMembership, roleId: string): Promise<void> {
  if (!(await getRoleReach(actor, roleId)).isWithinActor) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only assign roles within your own permissions',
    })
  }
}

/**
 * A role required fields stay fillable under: one that adds records to a table may not hold a
 * required field of it hidden or read-only. A schema manager writes every field.
 */
function assertRequiredFieldsFillable(name: string, grants: IRoleGrants, tables: IAccessTable[]) {
  const holder = { ...grants, isOwner: false }

  for (const table of tables) {
    const override = grants.tables.find((row) => row.tableId === table.id) ?? null
    const access = resolveTableAccess(holder, override)
    if (!access.canCreate) continue

    for (const field of table.fields) {
      if (!field.required) continue
      const fieldOverride = grants.fields.find((row) => row.fieldId === field.id)?.access ?? null
      if (resolveFieldAccess(holder, access, fieldOverride) === 'EDIT') continue

      throw createError({
        statusCode: 409,
        statusMessage: `Role "${name}" can add records to "${table.name}" but cannot fill "${field.name}"`,
      })
    }
  }
}

/**
 * Every check a role's whole input passes before it is written: its tables and fields are the
 * workspace's, it grants nothing beyond the actor, and its required fields stay fillable.
 */
function assertRoleWritable(
  ground: IAccessGround,
  actor: IWorkspaceMembership,
  input: TRoleInput,
): void {
  assertOverridesInWorkspace(input, ground.tables)
  if (!isWithinActor(ground, actor, input)) throw buildEscalationError()
  assertRequiredFieldsFillable(input.name, input, ground.tables)
}

async function createRoleOverrides(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  roleId: string,
  input: TRoleInput,
): Promise<void> {
  await tx.roleTableAccess.createMany({
    data: input.tables.map((row) => ({ workspaceId, roleId, ...row })),
  })
  await tx.roleFieldAccess.createMany({
    data: input.fields.map((row) => ({ workspaceId, roleId, ...row })),
  })
}

/**
 * The role and every row it sets apart, in one transaction. The cap is counted, not locked: two
 * creates racing past the count can land one role over it. It bounds the list a page renders,
 * which one extra role does not break.
 */
async function createRole(
  actor: IWorkspaceMembership,
  input: TRoleInput,
): Promise<IRoleDetailResponse> {
  const workspaceId = actor.workspace.id
  const ground = await loadAccessGround(workspaceId, [actor.role.id])
  assertRoleWritable(ground, actor, input)

  const roleCount = await prisma.workspaceRole.count({ where: { workspaceId } })

  if (roleCount >= MAX_WORKSPACE_ROLES) {
    throw createError({
      statusCode: 409,
      statusMessage: `A workspace can have at most ${MAX_WORKSPACE_ROLES} roles`,
    })
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.workspaceRole.create({
        data: { workspaceId, ...toRoleData(input) },
        select: roleSelect,
      })
      await createRoleOverrides(tx, workspaceId, role.id, input)
      return role
    })

    return toRoleDetail(created, input, ground.tables)
  } catch (error) {
    throw toHttpError(error, roleErrors)
  }
}

/**
 * Reads what the decision rests on: the role, the actor's grants and the tables. A version the
 * caller sent that is not the one read is stale at once (412); the write then repeats the version
 * read, so a role changed under the check is a 409 rather than a silent widening.
 */
async function loadEditableRole(
  actor: IWorkspaceMembership,
  roleId: string,
  expectedUpdatedAt?: Date,
) {
  const ground = await loadAccessGround(actor.workspace.id, [actor.role.id, roleId])
  const role = requireGroundRole(ground, roleId)

  if (!isWithinActor(ground, actor, toRoleGrants(role))) throw buildEscalationError()
  if (expectedUpdatedAt && expectedUpdatedAt.getTime() !== role.updatedAt.getTime()) {
    throw buildStaleWriteError('role')
  }

  return { ground, role }
}

function buildGuardedRoleWhere(workspaceId: string, role: TRoleGrantsRow) {
  return { ...buildRoleWhere(workspaceId, role.id), updatedAt: role.updatedAt }
}

async function getRole(actor: IWorkspaceMembership, roleId: string): Promise<IRoleDetailResponse> {
  const ground = await loadAccessGround(actor.workspace.id, [actor.role.id, roleId])
  const grantsRow = requireGroundRole(ground, roleId)
  const role = await prisma.workspaceRole.findUniqueOrThrow({
    where: buildRoleWhere(actor.workspace.id, roleId),
    select: roleSelect,
  })

  return {
    role: toSharedRole(role, isWithinActor(ground, actor, toRoleGrants(grantsRow))),
    overrides: toRoleOverrides(grantsRow),
    tables: ground.tables,
  }
}

async function listAccessTables(actor: IWorkspaceMembership): Promise<IAccessTable[]> {
  const tables = await prisma.table.findMany({
    where: { workspaceId: actor.workspace.id },
    orderBy: ACCESS_TABLE_ORDER,
    select: accessTableSelect,
  })
  return tables.map(toAccessTable)
}

/**
 * Every table and field must be the workspace's (404 otherwise), and a field's row must sit on a
 * table the role reads — on one it cannot, the row would narrow nothing (400).
 */
function assertOverridesInWorkspace(next: IRoleGrants, tables: IAccessTable[]) {
  const tableById = new Map(tables.map((table) => [table.id, table]))
  const tableByFieldId = new Map(
    tables.flatMap((table) => table.fields.map((field) => [field.id, table] as const)),
  )

  for (const row of next.tables) {
    if (!tableById.has(row.tableId)) {
      throw createError({ statusCode: 404, statusMessage: 'Table not found' })
    }
  }

  const holder = { ...next, isOwner: false }
  for (const row of next.fields) {
    const table = tableByFieldId.get(row.fieldId)
    if (!table) throw createError({ statusCode: 404, statusMessage: 'Field not found' })

    const override = next.tables.find((candidate) => candidate.tableId === table.id) ?? null
    if (!canReadRecords(resolveTableAccess(holder, override))) {
      throw createError({
        statusCode: 400,
        statusMessage: `A field of "${table.name}" cannot be set: the role does not see the table`,
      })
    }
  }
}

/**
 * Replaces the whole role — name, permissions, defaults and every row it sets apart — in one
 * transaction: the role's own row first, guarded by the version read, so a miss leaves the old
 * rows untouched.
 */
async function updateRole(
  actor: IWorkspaceMembership,
  roleId: string,
  input: TRoleInput,
  expectedUpdatedAt?: Date,
): Promise<IRoleDetailResponse> {
  const workspaceId = actor.workspace.id
  const { ground, role } = await loadEditableRole(actor, roleId, expectedUpdatedAt)
  assertRoleWritable(ground, actor, input)

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const updated = await tx.workspaceRole.update({
        where: buildGuardedRoleWhere(workspaceId, role),
        data: toRoleData(input),
        select: roleSelect,
      })
      await tx.roleTableAccess.deleteMany({ where: { roleId } })
      await tx.roleFieldAccess.deleteMany({ where: { roleId } })
      await createRoleOverrides(tx, workspaceId, roleId, input)
      return updated
    })

    return toRoleDetail(saved, input, ground.tables)
  } catch (error) {
    throw await toRoleWriteError(error, workspaceId, roleId)
  }
}

/**
 * A role just written is within its writer: the write was refused otherwise. Its tables are
 * counted from the input, since the row was read before its table rows were replaced.
 */
function toRoleDetail(
  row: TRoleRow,
  input: TRoleInput,
  tables: IAccessTable[],
): IRoleDetailResponse {
  return {
    role: {
      ...toSharedRole(row, true),
      readableTableCount: input.tables.filter((table) => canReadRecords(table)).length,
    },
    overrides: { tables: input.tables, fields: input.fields },
    tables,
  }
}

function toRoleData(input: TRoleInput) {
  return { name: input.name, permissions: input.permissions }
}

/** A miss on a role still there changed under the check (409); one gone is the usual 404. */
async function toRoleWriteError(error: unknown, workspaceId: string, roleId: string) {
  if (isMissingRow(error)) {
    const current = await prisma.workspaceRole.findUnique({
      where: buildRoleWhere(workspaceId, roleId),
      select: { id: true },
    })
    if (current) return buildChangedMeanwhileError('role')
  }
  return toHttpError(error, roleErrors)
}

/**
 * A role a member or an invitation still holds is refused by its foreign key, not by a count read
 * first.
 */
async function deleteRole(actor: IWorkspaceMembership, roleId: string): Promise<void> {
  const { role } = await loadEditableRole(actor, roleId)

  try {
    await prisma.workspaceRole.delete({
      where: buildGuardedRoleWhere(actor.workspace.id, role),
      select: { id: true },
    })
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw toHttpError(error, {
        inUse: 'Reassign the members of this role and revoke its invitations first',
      })
    }
    throw await toRoleWriteError(error, actor.workspace.id, roleId)
  }
}

export const RoleService = {
  listRoles,
  getRoleReach,
  requireAssignableRole,
  getRole,
  listAccessTables,
  createRole,
  updateRole,
  deleteRole,
}
