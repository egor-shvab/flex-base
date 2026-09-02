import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { FieldService } from '#server/services/fields'
import { TableService } from '#server/services/tables'
import type { IFieldDeletedResponse } from '#shared/types/api'

export default defineTableHandler(
  async ({ event, user, table }): Promise<IFieldDeletedResponse> => {
    await FieldService.deleteField(table.id, routeParam(event, 'fieldId'))

    return { ok: true, table: await TableService.getTableListRow(user.id, table.id) }
  },
)
