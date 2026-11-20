import { defineWorkspaceHandler } from '#server/utils/handler'
import { RoleService } from '#server/services/roles'
import type { IRolesResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_VIEW',
  async ({ membership }): Promise<IRolesResponse> => ({
    roles: await RoleService.listRoles(membership),
  }),
)
