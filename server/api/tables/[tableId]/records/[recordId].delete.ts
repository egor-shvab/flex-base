import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RecordService } from '#server/services/records'
import { TableService } from '#server/services/tables'
import type { IRecordDeletedResponse } from '#shared/types/api'

export default defineTableHandler(async ({ event, table }): Promise<IRecordDeletedResponse> => {
  await RecordService.deleteRecord(table.id, routeParam(event, 'recordId'))

  return { ok: true, table: await TableService.getTableListRow(table.id) }
})
