import { defineWorkspaceHandler } from '#server/utils/handler'
import { WorkspaceService } from '#server/services/workspaces'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler('OWNER', async ({ membership }): Promise<IOkResponse> => {
  await WorkspaceService.deleteWorkspace(membership.workspace.id)
  return { ok: true }
})
