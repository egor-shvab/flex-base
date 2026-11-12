import { defineEventHandler, readValidatedBody } from 'h3'
import { requireUser } from '#server/utils/auth'
import { WorkspaceService } from '#server/services/workspaces'
import { workspaceInputSchema } from '#shared/validation/workspace'
import type { IWorkspaceMembershipResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IWorkspaceMembershipResponse> => {
  const user = requireUser(event)
  const { name } = await readValidatedBody(event, workspaceInputSchema.parse)
  const membership = await WorkspaceService.createWorkspace(user.id, name)
  return { membership }
})
