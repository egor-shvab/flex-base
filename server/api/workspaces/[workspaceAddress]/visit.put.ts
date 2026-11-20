import { defineWorkspaceHandler } from '#server/utils/handler'
import { WorkspaceService } from '#server/services/workspaces'
import type { IOkResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'READ',
  async ({ user, membership }): Promise<IOkResponse> => {
    await WorkspaceService.setLastWorkspace(user.id, membership.workspace.id)
    return { ok: true }
  },
)
