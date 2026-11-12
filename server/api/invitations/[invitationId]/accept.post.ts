import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { routeParam } from '#server/utils/route'
import { InvitationService } from '#server/services/invitations'
import type { IWorkspaceMembershipResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<IWorkspaceMembershipResponse> => {
  const user = requireUser(event)
  const membership = await InvitationService.acceptInvitation(
    user,
    routeParam(event, 'invitationId'),
  )
  return { membership }
})
