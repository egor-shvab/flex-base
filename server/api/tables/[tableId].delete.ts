import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '#server/utils/auth'
import { deleteTable } from '#server/services/tables'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  await deleteTable(user.id, tableId)
  return { ok: true }
})
