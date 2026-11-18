import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { RoleService } from '#server/services/roles'
import { roleInputSchema } from '#shared/validation/workspace'
import type { IRoleDetailResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'ROLES_MANAGE',
  async ({ event, membership }): Promise<IRoleDetailResponse> => {
    const input = await readValidatedBody(event, roleInputSchema.parse)
    return RoleService.createRole(membership, input)
  },
)
