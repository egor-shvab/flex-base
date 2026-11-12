import { defineWorkspaceHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { TableService } from '#server/services/tables'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'TABLES_MANAGE',
  async ({ event, membership }): Promise<IOkResponse> => {
    await TableService.deleteTable(membership.workspace.id, routeParam(event, 'tableAddress'))
    return { ok: true }
  },
)
