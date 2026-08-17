import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { deleteRecord } from '#server/services/records'

export default defineTableHandler(async ({ event, table }) => {
  await deleteRecord(table.id, routeParam(event, 'recordId'))
  return { ok: true }
})
