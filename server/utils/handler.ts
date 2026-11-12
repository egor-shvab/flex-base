import { defineEventHandler, type H3Event } from 'h3'
import {
  requireRecordFields,
  requireWorkspaceTable,
  requireWorkspaceTableFields,
  requireWorkspaceTableWithFields,
  type IWorkspaceTableFields,
} from '#server/utils/table-access'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import {
  assertPermission,
  requireMembership,
  type TWorkspaceAccess,
} from '#server/utils/workspace-access'
import type { IAuthUser } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'
import type { IWorkspaceMembership } from '#shared/types/workspace'

interface IWorkspaceContext {
  event: H3Event
  user: IAuthUser
  membership: IWorkspaceMembership
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
  assertPermission(membership, access)

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

/** A route under one table: the workspace context plus what `lookup` proves about the table. */
function defineTableScopedHandler<TScope, T>(
  access: TWorkspaceAccess,
  lookup: (workspaceId: string, tableAddress: string) => Promise<TScope>,
  handler: (context: IWorkspaceContext & TScope) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const context = await resolveWorkspaceContext(event, access)
    const scope = await lookup(context.membership.workspace.id, routeParam(event, 'tableAddress'))

    return handler({ ...context, ...scope })
  })
}

export function defineTableHandler<T>(
  access: TWorkspaceAccess,
  handler: (context: IWorkspaceContext & { table: ITable }) => Promise<T>,
) {
  return defineTableScopedHandler(
    access,
    async (workspaceId, tableAddress) => ({
      table: await requireWorkspaceTable(workspaceId, tableAddress),
    }),
    handler,
  )
}

export function defineFieldsHandler<T>(
  access: TWorkspaceAccess,
  handler: (context: IWorkspaceContext & IWorkspaceTableFields) => Promise<T>,
) {
  return defineTableScopedHandler(access, requireWorkspaceTableFields, handler)
}

export function defineTableWithFieldsHandler<T>(
  access: TWorkspaceAccess,
  handler: (context: IWorkspaceContext & { table: ITable; fields: IField[] }) => Promise<T>,
) {
  return defineTableScopedHandler(access, requireWorkspaceTableWithFields, handler)
}

export function defineRecordWriteHandler<T>(
  access: TWorkspaceAccess,
  handler: (context: IWorkspaceContext & IWorkspaceTableFields) => Promise<T>,
) {
  return defineTableScopedHandler(access, requireRecordFields, handler)
}
