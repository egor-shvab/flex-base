import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { RecordService } from '#server/services/records'
import { TableService } from '#server/services/tables'
import { buildRecordSchema } from '#shared/validation/record'
import type { IRecordCreatedResponse } from '#shared/types/api'

export default defineRecordWriteHandler(
  async ({ event, user, tableId, fields }): Promise<IRecordCreatedResponse> => {
    const data = await readValidatedBody(event, buildRecordSchema(fields).parse)
    const record = await RecordService.createRecord(tableId, fields, data)

    // Read after the insert's own transaction, so the count includes the row just written
    return { record, table: await TableService.getTableListRow(user.id, tableId) }
  },
)
