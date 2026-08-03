import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTableWithFields } from '#server/utils/ownership'
import { getRecordDetail } from '#server/services/records'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  const recordId = getRouterParam(event, 'recordId') ?? ''
  const { table, fields } = await requireOwnedTableWithFields(user.id, tableId)

  return getRecordDetail({ id: table.id, name: table.name }, fields, recordId)
})
