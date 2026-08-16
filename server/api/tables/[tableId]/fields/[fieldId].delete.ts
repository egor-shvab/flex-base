import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { routeParam } from '#server/utils/route'
import { deleteField } from '#server/services/fields'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  const fieldId = routeParam(event, 'fieldId')
  await requireOwnedTable(user.id, tableId)
  await deleteField(tableId, fieldId)
  return { ok: true }
})
