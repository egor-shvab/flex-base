import { readValidatedBody } from 'h3'
import { defineRecordWriteHandler } from '#server/utils/handler'
import { toRecordActor } from '#server/utils/table-access'
import { RecordService } from '#server/services/records'
import { TableService } from '#server/services/tables'
import { buildRecordSchema } from '#shared/validation/record'
import type { IRecordCreatedResponse } from '#shared/types/api'

export default defineRecordWriteHandler(
  'create',
  async (context): Promise<IRecordCreatedResponse> => {
    const { event, membership, tableId, fields, editableFields, access } = context
    const data = await readValidatedBody(event, buildRecordSchema(editableFields).parse)
    const record = await RecordService.createRecord(tableId, fields, data, toRecordActor(context))

    return {
      record,
      table: await TableService.getTableListRow(membership.workspace.id, tableId, access),
    }
  },
)
