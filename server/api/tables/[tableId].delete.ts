import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import { TableService } from '#server/services/tables'
import type { IOkResponse } from '#shared/types/api'

// Not a `defineTableHandler`, for the same reason as the PATCH beside it — `deleteTable` takes
// the `userId` and scopes on it itself.
export default defineEventHandler(async (event): Promise<IOkResponse> => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  await TableService.deleteTable(user.id, tableId)
  return { ok: true }
})
