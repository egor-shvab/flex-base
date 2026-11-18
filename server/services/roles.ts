import { createError } from 'h3'
import type { Prisma } from '#server/generated/prisma/client'
import { prisma } from '#server/db/prisma'
import { ACCESS_TABLE_ORDER, accessTableSelect, toAccessTable } from '#server/db/tables'
import {
  buildRoleWhere,
  roleGrantsSelect,
  roleSelect,
  toRoleGrants,
  toRoleRows,
  toSharedRole,
  type TRoleGrantsRow,
  type TRoleRow,
} from '#server/db/workspaces'
import { isForeignKeyViolation, isMissingRow } from '#server/db/prisma-errors'
import { buildTableNotFoundError } from '#server/utils/table-access'
import {
  buildChangedMeanwhileError,
  buildStaleWriteError,
  toHttpError,
} from '#server/utils/http-errors'
import { NO_TABLE_ACCESS } from '#shared/constants/workspace'
import type { IRoleDetailResponse, ITableRoleAccess } from '#shared/types/api'
import type {
  IAccessTable,
  IRoleGrants,
  IWorkspaceMembership,
  IWorkspaceRole,
  TWorkspacePermission,
} from '#shared/types/workspace'
import { hasPermission, isHeldRoleLocked } from '#shared/utils/permissions'
import {
  findFieldOverride,
  findTableAccess,
  isAccessWithin,
  toRoleHolder,
} from '#shared/utils/role-access'
import { canReadRecords, resolveFieldAccess, resolveTableAccess } from '#shared/utils/table-access'
import type { TRoleInput, TTableAccessInput } from '#shared/validation/workspace'

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

/** The rule `isHeldRoleLocked` states, as the refusal every role write gives. */
function assertNotHeldRole(actor: IWorkspaceMembership, roleId: string) {
  if (isHeldRoleLocked(actor, roleId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the workspace owner can change the role you hold',
    })
  }
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

  return isAccessWithin(subject, toRoleHolder(toRoleGrants(actorRole)), ground.tables)
}

/**
 * The ground's tables as the actor sees them: those they read, with the fields not hidden from them.
 * A role editor is shown no more of the schema than its user meets elsewhere — the comparison still
 * runs over all of it. A role's rows go out whole: they hold only ids, and a role within the actor
 * may keep a field hidden that is hidden from the actor too, which a save must send back.
 */
function toVisibleTables(ground: IAccessGround, actor: IWorkspaceMembership): IAccessTable[] {
  if (actor.isOwner) return ground.tables

  const actorRole = ground.rolesById.get(actor.role.id)
  if (!actorRole) return []

  const holder = toRoleHolder(toRoleGrants(actorRole))

  return ground.tables.flatMap((table) => {
    const access = resolveTableAccess(holder, findTableAccess(holder, table.id))
    if (!canReadRecords(access)) return []

    const fields = table.fields.filter(
      (field) =>
        resolveFieldAccess(holder, access, findFieldOverride(holder, field.id)) !== 'HIDDEN',
    )
    return [{ ...table, fields }]
  })
}

function listRoleRows(workspaceId: string) {
  // The default roles share one `createdAt`: the name keeps their order stable
  return prisma.workspaceRole.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    select: roleSelect,
  })
}

/** Each role and its grants, with the ground they are compared over. */
async function loadRolesWithGround(actor: IWorkspaceMembership) {
  const rows = await listRoleRows(actor.workspace.id)
  const ground = await loadAccessGround(actor.workspace.id, [
    actor.role.id,
    ...rows.map((row) => row.id),
  ])

  return rows.map((row) => {
    const grants = ground.rolesById.get(row.id)
    return {
      grants,
      role: toSharedRole(
        row,
        grants !== undefined && isWithinActor(ground, actor, toRoleGrants(grants)),
      ),
    }
  })
}

/**
 * Each role with whether it is within the caller. Only a caller who can act on roles or their
 * holders needs the comparison; for anyone else it is false, and nothing more is read.
 */
async function listRoles(actor: IWorkspaceMembership): Promise<IWorkspaceRole[]> {
  if (!ROLE_REACH_PERMISSIONS.some((permission) => hasPermission(actor, permission))) {
    const rows = await listRoleRows(actor.workspace.id)
    return rows.map((row) => toSharedRole(row, false))
  }

  return (await loadRolesWithGround(actor)).map(({ role }) => role)
}

/** Every role with what it may do with one table's records: its row there, or nothing. */
async function listTableAccess(
  actor: IWorkspaceMembership,
  tableId: string,
): Promise<ITableRoleAccess[]> {
  return (await loadRolesWithGround(actor)).map(({ role, grants }) => ({
    role,
    access: (grants && findTableAccess(toRoleGrants(grants), tableId)) ?? NO_TABLE_ACCESS,
  }))
}

/**
 * Sets one table's access for several roles at once, each checked as a whole-role save would be:
 * not the actor's own, at the version read, within the actor before and after, its required fields
 * fillable. A role closed to the table loses its field rows there, which would narrow nothing. The
 * write guards every role's version in one statement, so a role changed meanwhile is a 409.
 */
async function setTableAccess(
  actor: IWorkspaceMembership,
  tableId: string,
  input: TTableAccessInput,
): Promise<ITableRoleAccess[]> {
  const workspaceId = actor.workspace.id
  for (const change of input.roles) assertNotHeldRole(actor, change.roleId)

  const ground = await loadAccessGround(workspaceId, [
    actor.role.id,
    ...input.roles.map((change) => change.roleId),
  ])
  const table = ground.tables.find((candidate) => candidate.id === tableId)
  if (!table) throw buildTableNotFoundError()
  const fieldIds = table.fields.map((field) => field.id)

  const writes = input.roles.map(({ roleId, updatedAt, ...access }) => {
    const role = requireGroundRole(ground, roleId)
    const current = toRoleGrants(role)
    // Scope before version, as `loadEditableRole`: a 412 would invite a retry that cannot land
    if (!isWithinActor(ground, actor, current)) throw buildEscalationError()
    if (new Date(updatedAt).getTime() !== role.updatedAt.getTime()) {
      throw buildStaleWriteError('role')
    }

    // Access that reads nothing is no row; a role that manages tables reads whatever its row says
    const isOpen = canReadRecords(access)
    const isRead = canReadRecords(resolveTableAccess(toRoleHolder(current), access))
    const next: IRoleGrants = {
      ...current,
      tables: [
        ...current.tables.filter((row) => row.tableId !== tableId),
        ...(isOpen ? [{ tableId, ...access }] : []),
      ],
      fields: isRead
        ? current.fields
        : current.fields.filter((row) => !fieldIds.includes(row.fieldId)),
    }
    if (!isWithinActor(ground, actor, next)) throw buildEscalationError()
    assertRequiredFieldsFillable(role.name, next, ground.tables)

    return { role, access, isOpen, isRead }
  })
  const roleIds = writes.map((write) => write.role.id)

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.workspaceRole.updateMany({
        where: {
          workspaceId,
          OR: writes.map(({ role }) => ({ id: role.id, updatedAt: role.updatedAt })),
        },
        data: { updatedAt: new Date() },
      })
      if (count !== writes.length) throw buildChangedMeanwhileError('role')

      await tx.roleTableAccess.deleteMany({ where: { tableId, roleId: { in: roleIds } } })
      await tx.roleTableAccess.createMany({
        data: writes
          .filter((write) => write.isOpen)
          .map(({ role, access }) => ({ workspaceId, roleId: role.id, tableId, ...access })),
      })
      await tx.roleFieldAccess.deleteMany({
        where: {
          roleId: { in: writes.filter((write) => !write.isRead).map((write) => write.role.id) },
          fieldId: { in: fieldIds },
        },
      })
    })
  } catch (error) {
    throw toHttpError(error, roleErrors)
  }

  return listTableAccess(actor, tableId)
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
  const holder = toRoleHolder(grants)

  for (const table of tables) {
    const access = resolveTableAccess(holder, findTableAccess(grants, table.id))
    if (!access.canCreate) continue

    for (const field of table.fields) {
      if (!field.required) continue
      const fieldOverride = findFieldOverride(grants, field.id)
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
  assertRowsInWorkspace(input, ground.tables)
  if (!isWithinActor(ground, actor, input)) throw buildEscalationError()
  assertRequiredFieldsFillable(input.name, input, ground.tables)
}

async function createRoleRows(
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
      await createRoleRows(tx, workspaceId, role.id, input)
      return role
    })

    return toRoleDetail(created, input, toVisibleTables(ground, actor))
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
  assertNotHeldRole(actor, roleId)
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
  const [ground, role] = await Promise.all([
    loadAccessGround(actor.workspace.id, [actor.role.id, roleId]),
    prisma.workspaceRole.findUnique({
      where: buildRoleWhere(actor.workspace.id, roleId),
      select: roleSelect,
    }),
  ])
  const grantsRow = requireGroundRole(ground, roleId)
  if (!role) throw buildRoleNotFoundError()

  return {
    role: toSharedRole(role, isWithinActor(ground, actor, toRoleGrants(grantsRow))),
    overrides: toRoleRows(grantsRow),
    tables: toVisibleTables(ground, actor),
  }
}

async function listAccessTables(actor: IWorkspaceMembership): Promise<IAccessTable[]> {
  return toVisibleTables(await loadAccessGround(actor.workspace.id, [actor.role.id]), actor)
}

/**
 * Every table and field must be the workspace's (404 otherwise), and a field's row must sit on a
 * table the role reads — on one it cannot, the row would narrow nothing (400).
 */
function assertRowsInWorkspace(next: IRoleGrants, tables: IAccessTable[]) {
  const tableById = new Map(tables.map((table) => [table.id, table]))
  const tableByFieldId = new Map(
    tables.flatMap((table) => table.fields.map((field) => [field.id, table] as const)),
  )

  for (const row of next.tables) {
    if (!tableById.has(row.tableId)) {
      throw buildTableNotFoundError()
    }
  }

  const holder = toRoleHolder(next)
  for (const row of next.fields) {
    const table = tableByFieldId.get(row.fieldId)
    if (!table) throw createError({ statusCode: 404, statusMessage: 'Field not found' })

    if (!canReadRecords(resolveTableAccess(holder, findTableAccess(next, table.id)))) {
      throw createError({
        statusCode: 400,
        statusMessage: `A field of "${table.name}" cannot be set: the role does not see the table`,
      })
    }
  }
}

/**
 * Replaces the whole role — name, permissions and every row it sets apart — in one
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
      await createRoleRows(tx, workspaceId, roleId, input)
      return updated
    })

    return toRoleDetail(saved, input, toVisibleTables(ground, actor))
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
      readableTableCount: input.tables.length,
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
  listTableAccess,
  setTableAccess,
  getRoleReach,
  requireAssignableRole,
  getRole,
  listAccessTables,
  createRole,
  updateRole,
  deleteRole,
}
