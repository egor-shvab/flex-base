import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { createRecord } from '#server/services/records'
import { getTableListRow } from '#server/services/tables'
import { buildRecordSchema } from '#shared/validation/record'
import type { IRecordCreatedResponse } from '#shared/types/api'

export default defineRecordWriteHandler(
  async ({ event, tableId, fields }): Promise<IRecordCreatedResponse> => {
    const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
    const record = await createRecord(tableId, fields, data)

    // Read after the insert's own transaction, so the count includes the row just written
    return { record, table: await getTableListRow(tableId) }
  },
)
