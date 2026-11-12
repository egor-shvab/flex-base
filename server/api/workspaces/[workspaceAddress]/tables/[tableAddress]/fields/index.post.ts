import { readValidatedBody } from 'h3'
import { defineTableHandler } from '#server/utils/handler'
import { requireFieldTarget } from '#server/utils/table-access'
import { FieldService } from '#server/services/fields'
import { TableService } from '#server/services/tables'
import { fieldInputSchema } from '#shared/validation/field'
import type { IFieldCreatedResponse } from '#shared/types/api'

export default defineTableHandler(
  'TABLES_MANAGE',
  async ({ event, membership, table }): Promise<IFieldCreatedResponse> => {
    const input = await readValidatedBody(event, fieldInputSchema.parse)
    await requireFieldTarget(membership.workspace.id, input)
    const field = await FieldService.createField(table.id, input)

    return { field, table: await TableService.getTableListRow(membership.workspace.id, table.id) }
  },
)
