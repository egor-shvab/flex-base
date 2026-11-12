import { defineWorkspaceHandler } from '#server/utils/handler'
import { TableService } from '#server/services/tables'
import type { ITablesResponse } from '#shared/types/api'

export default defineWorkspaceHandler('READ', async ({ membership }): Promise<ITablesResponse> => {
  const tables = await TableService.listTables(membership.workspace.id)
  return { tables }
})
