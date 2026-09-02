import { defineTableWithFieldsHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RecordService } from '#server/services/records'
import type { IRecordDetail } from '#shared/types/record'

export default defineTableWithFieldsHandler(
  async ({ event, table, fields }): Promise<IRecordDetail> => {
    const recordAddress = routeParam(event, 'recordAddress')

    return RecordService.getRecordDetail(
      { id: table.id, number: table.number, name: table.name },
      fields,
      recordAddress,
    )
  },
)
