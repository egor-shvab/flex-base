import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { WorkspaceService } from '#server/services/workspaces'
import type { IWorkspacesResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IWorkspacesResponse> => {
  const user = requireUser(event)
  return WorkspaceService.listMemberships(user.id)
})
