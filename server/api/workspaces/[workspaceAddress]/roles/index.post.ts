import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { RoleService } from '#server/services/roles'
import { roleInputSchema } from '#shared/validation/workspace'
import type { IRoleResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_MANAGE',
  async ({ event, membership }): Promise<IRoleResponse> => {
    const input = await readValidatedBody(event, roleInputSchema.parse)
    const role = await RoleService.createRole(membership, input)
    return { role }
  },
)
