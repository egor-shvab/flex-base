import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { toRecordActor } from '#server/utils/table-access'
import { readIfMatchVersion } from '#server/utils/if-match'
import { routeParam } from '#server/utils/route'
import { RecordService } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'
import type { IRecordResponse } from '#shared/types/api'

export default defineRecordWriteHandler('update', async (context): Promise<IRecordResponse> => {
  const { event, tableId, fields, editableFields } = context
  const recordAddress = routeParam(event, 'recordAddress')
  const expectedUpdatedAt = readIfMatchVersion(event)
  const data = await readValidatedBody(event, buildRecordSchema(editableFields).parse)
  const record = await RecordService.updateRecord(
    tableId,
    fields,
    recordAddress,
    data,
    toRecordActor(context),
    expectedUpdatedAt,
  )
  return { record }
})
