import { defineEventHandler, getRouterParam, getValidatedQuery } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTableFields } from '#server/utils/ownership'
import { listRecords } from '#server/services/records'
import { buildRecordQuerySchema } from '#shared/validation/record'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = getRouterParam(event, 'tableId') ?? ''
  // Field metadata resolves the sort/filter params, so it comes with the ownership check
  const fields = await requireOwnedTableFields(user.id, tableId)
  const query = await getValidatedQuery(event, buildRecordQuerySchema(fields).parse)
  return listRecords(tableId, fields, query)
})
