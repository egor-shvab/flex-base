import { defineTableHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { FieldService } from '#server/services/fields'
import { TableService } from '#server/services/tables'
import type { IFieldDeletedResponse } from '#shared/types/api'

export default defineTableHandler(
  'TABLES_MANAGE',
  async ({ event, membership, table, access }): Promise<IFieldDeletedResponse> => {
    await FieldService.deleteField(membership.workspace.id, table.id, routeParam(event, 'fieldId'))

    return {
      ok: true,
      table: await TableService.getTableListRow(membership.workspace.id, table.id, access),
    }
  },
)
