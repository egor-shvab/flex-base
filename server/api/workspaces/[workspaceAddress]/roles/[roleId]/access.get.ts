import { defineWorkspaceHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RoleService } from '#server/services/roles'
import type { IRoleAccessResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_MANAGE',
  async ({ event, membership }): Promise<IRoleAccessResponse> =>
    RoleService.getRoleAccess(membership, routeParam(event, 'roleId')),
)
