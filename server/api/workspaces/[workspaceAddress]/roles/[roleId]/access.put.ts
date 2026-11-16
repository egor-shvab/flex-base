import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { readIfMatchVersion } from '#server/utils/if-match'
import { routeParam } from '#server/utils/route'
import { RoleService } from '#server/services/roles'
import { roleAccessSchema } from '#shared/validation/role-access'
import type { IRoleAccessResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_MANAGE',
  async ({ event, membership }): Promise<IRoleAccessResponse> => {
    const expectedUpdatedAt = readIfMatchVersion(event)
    const input = await readValidatedBody(event, roleAccessSchema.parse)

    return RoleService.updateRoleAccess(
      membership,
      routeParam(event, 'roleId'),
      input,
      expectedUpdatedAt,
    )
  },
)
