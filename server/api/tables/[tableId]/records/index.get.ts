import { defineEventHandler, getRouterParam, getValidatedQuery } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTable } from '#server/utils/ownership'
import { listRecords } from '#server/services/records'
import { recordQuerySchema } from '#shared/validation/record'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  await requireOwnedTable(user.id, tableId)
  const query = await getValidatedQuery(event, recordQuerySchema.parse)
  return listRecords(tableId, query)
})
