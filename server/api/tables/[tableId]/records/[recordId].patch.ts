import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { updateRecord } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'

export default defineRecordWriteHandler(async ({ event, tableId, fields }) => {
  const recordId = routeParam(event, 'recordId')
  const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
  const record = await updateRecord(tableId, fields, recordId, data)
  return { record }
})
