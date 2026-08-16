import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { routeParam } from '#server/utils/route'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  const table = await requireOwnedTable(user.id, tableId)
  return { table }
})
