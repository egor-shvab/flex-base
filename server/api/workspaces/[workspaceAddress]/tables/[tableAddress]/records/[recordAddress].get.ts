import { defineTableWithFieldsHandler } from '#server/utils/handler'
import { toRecordActor } from '#server/utils/table-access'
import { routeParam } from '#server/utils/route'
import { RecordService } from '#server/services/records'
import type { IRecordDetail } from '#shared/types/record'

export default defineTableWithFieldsHandler('READ', async (context): Promise<IRecordDetail> => {
  const { event, table, fields } = context
  const recordAddress = routeParam(event, 'recordAddress')

  return RecordService.getRecordDetail(
    { id: table.id, number: table.number, name: table.name },
    fields,
    recordAddress,
    toRecordActor(context),
  )
})
