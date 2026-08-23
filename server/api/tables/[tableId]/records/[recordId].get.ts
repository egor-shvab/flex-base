import { defineTableWithFieldsHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RecordService } from '#server/services/records'
import type { IRecordDetail } from '#shared/types/record'

export default defineTableWithFieldsHandler(
  async ({ event, table, fields }): Promise<IRecordDetail> => {
    const recordId = routeParam(event, 'recordId')

    return RecordService.getRecordDetail({ id: table.id, name: table.name }, fields, recordId)
  },
)
