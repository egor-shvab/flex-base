import { defineEventHandler, type H3Event } from 'h3'
import {
  requireOwnedTable,
  requireOwnedTableFields,
  requireOwnedTableWithFields,
  requireRecordFields,
} from '#server/utils/ownership'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import type { IAuthUser } from '#shared/types/auth'
import type { IField } from '#shared/types/field'
import type { ITable } from '#shared/types/table'

interface IHandlerContext {
  event: H3Event
  user: IAuthUser
}

export function defineTableHandler<T>(
  handler: (context: IHandlerContext & { table: ITable }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const table = await requireOwnedTable(user.id, routeParam(event, 'tableAddress'))

    return handler({ event, user, table })
  })
}

export function defineFieldsHandler<T>(
  handler: (context: IHandlerContext & { tableId: string; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const { tableId, fields } = await requireOwnedTableFields(
      user.id,
      routeParam(event, 'tableAddress'),
    )

    return handler({ event, user, tableId, fields })
  })
}

export function defineTableWithFieldsHandler<T>(
  handler: (context: IHandlerContext & { table: ITable; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const { table, fields } = await requireOwnedTableWithFields(
      user.id,
      routeParam(event, 'tableAddress'),
    )

    return handler({ event, user, table, fields })
  })
}

export function defineRecordWriteHandler<T>(
  handler: (context: IHandlerContext & { tableId: string; fields: IField[] }) => Promise<T>,
) {
  return defineEventHandler(async (event): Promise<T> => {
    const user = requireUser(event)
    const { tableId, fields } = await requireRecordFields(
      user.id,
      routeParam(event, 'tableAddress'),
    )

    return handler({ event, user, tableId, fields })
  })
}
