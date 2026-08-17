import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { createRecord } from '#server/services/records'
import { buildRecordSchema } from '#shared/validation/record'
import type { IRecordResponse } from '#shared/types/api'

export default defineRecordWriteHandler(
  async ({ event, tableId, fields }): Promise<IRecordResponse> => {
    const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
    const record = await createRecord(tableId, fields, data)
    return { record }
  },
)
