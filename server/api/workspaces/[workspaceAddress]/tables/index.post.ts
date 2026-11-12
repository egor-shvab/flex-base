import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { TableService } from '#server/services/tables'
import { tableInputSchema } from '#shared/validation/table'
import type { ITableListItemResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'TABLES_MANAGE',
  async ({ event, membership }): Promise<ITableListItemResponse> => {
    const { name } = await readValidatedBody(event, tableInputSchema.parse)
    const table = await TableService.createTable(membership.workspace.id, name)
    return { table }
  },
)
