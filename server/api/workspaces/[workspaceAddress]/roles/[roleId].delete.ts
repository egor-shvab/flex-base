import { defineWorkspaceHandler } from '#server/utils/handler'
import { routeParam } from '#server/utils/route'
import { RoleService } from '#server/services/roles'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_MANAGE',
  async ({ event, membership }): Promise<IOkResponse> => {
    await RoleService.deleteRole(membership, routeParam(event, 'roleId'))
    return { ok: true }
  },
)
