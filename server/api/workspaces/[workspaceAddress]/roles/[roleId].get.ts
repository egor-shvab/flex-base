import { defineWorkspaceHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RoleService } from '#server/services/roles'
import type { IRoleDetailResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_MANAGE',
  async ({ event, membership }): Promise<IRoleDetailResponse> =>
    RoleService.getRole(membership, routeParam(event, 'roleId')),
)
