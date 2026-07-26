import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { deleteRecord } from '#server/services/records'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const recordId = getRouterParam(event, 'recordId') ?? ''
  await requireOwnedTable(user.id, tableId)
  await deleteRecord(tableId, recordId)
  return { ok: true }
})
