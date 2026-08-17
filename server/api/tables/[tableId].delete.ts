import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import { deleteTable } from '#server/services/tables'

// Not a `defineTableHandler`, for the same reason as the PATCH beside it — `deleteTable` takes
// the `userId` and scopes on it itself.
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  await deleteTable(user.id, tableId)
  return { ok: true }
})
