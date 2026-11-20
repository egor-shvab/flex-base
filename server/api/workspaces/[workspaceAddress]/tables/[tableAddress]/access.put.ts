import { readValidatedBody } from 'h3'
import { defineTableHandler } from '#server/utils/handler'
import { RoleService } from '#server/services/roles'
import { tableAccessInputSchema } from '#shared/validation/workspace'
import type { ITableAccessResponse } from '#shared/types/api'

export default defineTableHandler(
  'ROLES_MANAGE',
  async ({ event, membership, table }): Promise<ITableAccessResponse> => {
    const input = await readValidatedBody(event, tableAccessInputSchema.parse)
    return { roles: await RoleService.setTableAccess(membership, table.id, input) }
  },
)
