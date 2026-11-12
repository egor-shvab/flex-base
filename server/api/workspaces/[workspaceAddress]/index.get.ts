import { defineWorkspaceHandler } from '#server/utils/handler'
import type { IWorkspaceMembershipResponse } from '#shared/types/api'

export default defineWorkspaceHandler(
  'READ',
  async ({ membership }): Promise<IWorkspaceMembershipResponse> => ({ membership }),
)
