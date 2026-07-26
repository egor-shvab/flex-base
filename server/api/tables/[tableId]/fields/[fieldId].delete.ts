import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { deleteField } from '#server/services/fields'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const fieldId = getRouterParam(event, 'fieldId') ?? ''
  await requireOwnedTable(user.id, tableId)
  await deleteField(tableId, fieldId)
  return { ok: true }
})
