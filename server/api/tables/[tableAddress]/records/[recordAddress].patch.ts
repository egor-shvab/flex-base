import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RecordService } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'
import type { IRecordResponse } from '#shared/types/api'

export default defineRecordWriteHandler(
  async ({ event, tableId, fields }): Promise<IRecordResponse> => {
    const recordAddress = routeParam(event, 'recordAddress')
    const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
    const record = await RecordService.updateRecord(tableId, fields, recordAddress, data)
    return { record }
  },
)
