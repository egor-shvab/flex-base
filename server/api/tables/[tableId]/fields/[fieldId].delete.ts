import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { deleteField } from '#server/services/fields'
import { getTableListRow } from '#server/services/tables'
import type { IFieldDeletedResponse } from '#shared/types/api'

export default defineTableHandler(async ({ event, table }): Promise<IFieldDeletedResponse> => {
  await deleteField(table.id, routeParam(event, 'fieldId'))

  return { ok: true, table: await getTableListRow(table.id) }
})
