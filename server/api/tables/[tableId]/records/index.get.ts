import { getValidatedQuery } from 'h3'
import { defineFieldsHandler } from '#server/utils/handler'
import { listRecords } from '#server/services/records'
import type { IRecordQuery } from '#shared/types/record'
import { parseRecordQueryState } from '#shared/utils/record-query'
import { buildRecordQuerySchema } from '#shared/validation/record'

export default defineFieldsHandler(async ({ event, tableId, fields }) => {
  // The schema validates; the codec decodes — the same reader the client uses on the URL
  const params = await getValidatedQuery(event, buildRecordQuerySchema(fields).parse)
  const query: IRecordQuery = {
    ...parseRecordQueryState(fields, params),
    pageSize: params.pageSize,
  }

  return listRecords(tableId, fields, query)
})
