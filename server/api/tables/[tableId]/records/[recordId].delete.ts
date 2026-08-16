import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { routeParam } from '#server/utils/route'
import { deleteRecord } from '#server/services/records'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  const recordId = routeParam(event, 'recordId')
  await requireOwnedTable(user.id, tableId)
  await deleteRecord(tableId, recordId)
  return { ok: true }
})
