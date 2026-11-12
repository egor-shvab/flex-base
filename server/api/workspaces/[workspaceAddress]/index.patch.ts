import { readValidatedBody } from 'h3'
import { defineWorkspaceHandler } from '#server/utils/handler'
import { WorkspaceService } from '#server/services/workspaces'
import { workspaceInputSchema } from '#shared/validation/workspace'
import type { IWorkspaceResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'WORKSPACE_UPDATE',
  async ({ event, membership }): Promise<IWorkspaceResponse> => {
    const { name } = await readValidatedBody(event, workspaceInputSchema.parse)
    const workspace = await WorkspaceService.renameWorkspace(membership.workspace.id, name)
    return { workspace }
  },
)
