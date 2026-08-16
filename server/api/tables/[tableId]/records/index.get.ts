import { defineEventHandler, getValidatedQuery } from 'h3'
import { requireUser } from '#server/utils/auth'
import { requireOwnedTableFields } from '#server/utils/ownership'
import { routeParam } from '#server/utils/route'
import { listRecords } from '#server/services/records'
import type { IRecordQuery } from '#shared/types/record'
import { parseRecordQueryState } from '#shared/utils/record-query'
import { buildRecordQuerySchema } from '#shared/validation/record'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const tableId = routeParam(event, 'tableId')
  // Field metadata resolves the sort/filter params, so it comes with the ownership check
  const fields = await requireOwnedTableFields(user.id, tableId)

  // The schema validates; the codec decodes — the same reader the client uses on the URL
  const params = await getValidatedQuery(event, buildRecordQuerySchema(fields).parse)
  const query: IRecordQuery = {
    ...parseRecordQueryState(fields, params),
    pageSize: params.pageSize,
  }

  return listRecords(tableId, fields, query)
})
