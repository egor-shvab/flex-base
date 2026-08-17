import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { deleteRecord } from '#server/services/records'
import { getTableListRow } from '#server/services/tables'
import type { IRecordDeletedResponse } from '#shared/types/api'

export default defineTableHandler(async ({ event, table }): Promise<IRecordDeletedResponse> => {
  await deleteRecord(table.id, routeParam(event, 'recordId'))

  return { ok: true, table: await getTableListRow(table.id) }
})
