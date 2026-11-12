import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { WorkspaceService } from '#server/services/workspaces'
import { transferOwnershipSchema } from '#shared/validation/workspace'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'OWNER',
  async ({ event, membership }): Promise<IOkResponse> => {
    const { memberId } = await readValidatedBody(event, transferOwnershipSchema.parse)
    await WorkspaceService.transferOwnership(membership, memberId)
    return { ok: true }
  },
)
