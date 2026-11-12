import { defineWorkspaceHandler } from '#server/utils/handler'
import { WorkspaceService } from '#server/services/workspaces'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler('READ', async ({ membership }): Promise<IOkResponse> => {
  await WorkspaceService.leaveWorkspace(membership)
  return { ok: true }
})
