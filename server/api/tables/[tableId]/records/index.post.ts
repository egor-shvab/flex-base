import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { createRecord } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'

export default defineRecordWriteHandler(async ({ event, tableId, fields }) => {
  const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
  const record = await createRecord(tableId, fields, data)
  return { record }
})
