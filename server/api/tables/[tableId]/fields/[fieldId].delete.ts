import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { deleteField } from '#server/services/fields'
import type { IOkResponse } from '#shared/types/api'

export default defineTableHandler(async ({ event, table }): Promise<IOkResponse> => {
  await deleteField(table.id, routeParam(event, 'fieldId'))
  return { ok: true }
})
