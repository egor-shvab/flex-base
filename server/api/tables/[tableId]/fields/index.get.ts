import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { listFields } from '#server/services/fields'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  await requireOwnedTable(user.id, tableId)
  const fields = await listFields(tableId)
  return { fields }
})
