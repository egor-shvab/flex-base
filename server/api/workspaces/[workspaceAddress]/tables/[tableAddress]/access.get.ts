import { defineTableHandler } from '#server/utils/handler'
import { RoleService } from '#server/services/roles'
import type { ITableAccessResponse } from '#shared/types/api'

export default defineTableHandler(
  'ROLES_MANAGE',
  async ({ membership, table }): Promise<ITableAccessResponse> => ({
    roles: await RoleService.listTableAccess(membership, table.id),
  }),
)
