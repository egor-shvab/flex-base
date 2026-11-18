import { defineWorkspaceHandler } from '#server/utils/handler'
import { RoleService } from '#server/services/roles'
import type { IAccessTablesResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_MANAGE',
  async ({ membership }): Promise<IAccessTablesResponse> => ({
    tables: await RoleService.listAccessTables(membership),
  }),
)
