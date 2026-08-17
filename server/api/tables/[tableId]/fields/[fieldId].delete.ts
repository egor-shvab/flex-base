import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { deleteField } from '#server/services/fields'

export default defineTableHandler(async ({ event, table }) => {
  await deleteField(table.id, routeParam(event, 'fieldId'))
  return { ok: true }
})
