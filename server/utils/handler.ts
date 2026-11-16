import { defineEventHandler, type H3Event } from 'h3'
import {
  assertRecordAction,
  assertTableHasFields,
  requireWorkspaceTable,
  requireWorkspaceTableFields,
  requireWorkspaceTableWithFields,
  type ITableScope,
  type IWorkspaceTableFields,
} from '#server/utils/table-access'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import {
  assertAccess,
  requireMembership,
  type TWorkspaceAccess,
} from '#server/utils/workspace-access'
import { RECORD_ACTIONS } from '#shared/constants/workspace'
import type { IAuthUser } from '#shared/types/auth'
import type { ITable } from '#shared/types/table'
import type { IWorkspaceMembership, TRecordAction } from '#shared/types/workspace'

interface IWorkspaceContext {
  event: H3Event
  user: IAuthUser
  membership: IWorkspaceMembership
}

/** A table route names a workspace access, or a record action its table's access must allow. */
export type TTableRouteAccess = TWorkspaceAccess | TRecordAction

function isRecordAction(access: TTableRouteAccess): access is TRecordAction {
  return (RECORD_ACTIONS as readonly string[]).includes(access)
}

/**
 * The permission is checked before the table is looked up: a member without it gets the same 403
 * for a table that does not exist, which reveals nothing they could not already read.
 */
async function resolveWorkspaceContext(
  event: H3Event,
  access: TWorkspaceAccess,
): Promise<IWorkspaceContext> {
  const user = requireUser(event)
  const membership = await requireMembership(user.id, routeParam(event, 'workspaceAddress'))
  assertAccess(membership, access)

  return { event, user, membership }
}

export function defineWorkspaceHandler<T>(
  access: TWorkspaceAccess,
  handler: (context: IWorkspaceContext) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> =>
    handler(await resolveWorkspaceContext(event, access)),
  )
}

/**
 * A route under one table: the workspace context plus what `lookup` proves about the table. A
 * record action is checked once the table is found, since it is the table's access that grants
 * it; a table the caller may not read is a 404 before that.
 */
function defineTableScopedHandler<TScope extends ITableScope, T>(
  access: TTableRouteAccess,
  lookup: (membership: IWorkspaceMembership, tableAddress: string) => Promise<TScope>,
  handler: (context: IWorkspaceContext & TScope) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const context = await resolveWorkspaceContext(event, isRecordAction(access) ? 'READ' : access)
    const scope = await lookup(context.membership, routeParam(event, 'tableAddress'))

    if (isRecordAction(access)) assertRecordAction(scope.access, access)

    return handler({ ...context, ...scope })
  })
}

export function defineTableHandler<T>(
  access: TTableRouteAccess,
  handler: (context: IWorkspaceContext & ITableScope & { table: ITable }) => Promise<T>,
) {
  return defineTableScopedHandler(access, requireWorkspaceTable, handler)
}

export function defineFieldsHandler<T>(
  access: TTableRouteAccess,
  handler: (context: IWorkspaceContext & IWorkspaceTableFields) => Promise<T>,
) {
  return defineTableScopedHandler(access, requireWorkspaceTableFields, handler)
}

export function defineTableWithFieldsHandler<T>(
  access: TTableRouteAccess,
  handler: (context: IWorkspaceContext & IWorkspaceTableFields & { table: ITable }) => Promise<T>,
) {
  return defineTableScopedHandler(access, requireWorkspaceTableWithFields, handler)
}

export function defineRecordWriteHandler<T>(
  action: TRecordAction,
  handler: (context: IWorkspaceContext & IWorkspaceTableFields) => Promise<T>,
) {
  return defineTableScopedHandler(action, requireWorkspaceTableFields, (context) => {
    assertTableHasFields(context.fields)
    return handler(context)
  })
}
