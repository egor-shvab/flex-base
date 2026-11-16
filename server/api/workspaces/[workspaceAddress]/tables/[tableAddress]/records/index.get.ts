import { getValidatedQuery } from 'h3'
import { defineFieldsHandler } from '#server/utils/handler'
import { toRecordActor } from '#server/utils/table-access'
import { RecordService } from '#server/services/records'
import type { IRecordPage, IRecordQuery } from '#shared/types/record'
import { parseRecordQueryState } from '#shared/utils/record-query'
import { buildRecordQuerySchema } from '#shared/validation/record'

export default defineFieldsHandler('READ', async (context): Promise<IRecordPage> => {
  const { event, tableId, fields } = context
  const params = await getValidatedQuery(event, buildRecordQuerySchema(fields).parse)
  const query: IRecordQuery = {
    ...parseRecordQueryState(fields, params),
    pageSize: params.pageSize,
  }

  return RecordService.listRecords(tableId, fields, query, toRecordActor(context))
})
