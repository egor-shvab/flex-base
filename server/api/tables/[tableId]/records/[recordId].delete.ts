import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { deleteRecord } from '#server/services/records'
import type { IOkResponse } from '#shared/types/api'

export default defineTableHandler(async ({ event, table }): Promise<IOkResponse> => {
  await deleteRecord(table.id, routeParam(event, 'recordId'))
  return { ok: true }
})
